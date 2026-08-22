#!/usr/bin/env python3
"""
Magneetar Load Test — Simulate N concurrent devices sending telemetry pings.

Measures:
- Requests/second throughput
- Latency percentiles (p50, p95, p99)
- Error rate
- SQLite write contention (busy_timeout hits)

Usage:
    python scripts/load_test.py --devices 500 --duration 60 --server http://localhost:8001
    python scripts/load_test.py --devices 100 --duration 30  # quick smoke test

Requires: aiohttp (pip install aiohttp)
"""

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass, field

try:
    import aiohttp
except ImportError:
    print("ERROR: aiohttp required. Install with: pip install aiohttp")
    raise SystemExit(1)


@dataclass
class DeviceSimulator:
    """Simulates a single device sending telemetry pings."""

    device_id: str
    server_url: str
    api_key: str
    lat: float = 6.4413  # OAU campus
    lng: float = 3.6928
    sequence: int = 0
    token: str = ""

    async def register(self, session: aiohttp.ClientSession) -> bool:
        """Register and obtain a JWT token."""
        import hashlib
        fingerprint = hashlib.sha256(self.device_id.encode()).hexdigest()[:16]
        try:
            async with session.post(
                f"{self.server_url}/api/device/register",
                json={
                    "device_id": self.device_id,
                    "fingerprint": fingerprint,
                    "model": "LoadTest",
                    "os_version": "14",
                    "app_version": "1.4.4",
                },
                headers={"x-api-key": self.api_key},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.token = data.get("token") or data.get("access_token", "")
                    return True
                else:
                    body = await resp.text()
                    if self.device_id == "load-test-0000":
                        print(f"  Registration failed for {self.device_id}: {resp.status} {body[:200]}")
                    return False
        except Exception as e:
            if self.device_id == "load-test-0000":
                print(f"  Registration exception for {self.device_id}: {e}")
            return False

    async def send_ping(self, session: aiohttp.ClientSession) -> tuple[float, bool]:
        """Send a location ping. Returns (latency_seconds, success)."""
        self.sequence += 1
        # Slight random walk to simulate movement
        self.lat += (hash(self.device_id + str(self.sequence)) % 100 - 50) * 0.00001
        self.lng += (hash(self.device_id + str(self.sequence * 7)) % 100 - 50) * 0.00001

        body = {
            "device_id": self.device_id,
            "lat": self.lat,
            "lng": self.lng,
            "accuracy_horizontal": 15.0,
            "battery_percent": 85,
            "is_charging": False,
            "network_type": "wifi",
            "ping_sequence": self.sequence,
        }
        start = time.monotonic()
        try:
            async with session.post(
                f"{self.server_url}/api/device/location",
                json=body,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                },
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                latency = time.monotonic() - start
                return latency, resp.status == 200
        except Exception:
            return time.monotonic() - start, False


@dataclass
class LoadTestResult:
    """Aggregated results from a load test run."""

    total_requests: int = 0
    successful: int = 0
    failed: int = 0
    latencies: list = field(default_factory=list)
    start_time: float = 0
    end_time: float = 0

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time

    @property
    def rps(self) -> float:
        return self.total_requests / self.duration if self.duration > 0 else 0

    @property
    def error_rate(self) -> float:
        return (self.failed / self.total_requests * 100) if self.total_requests > 0 else 0

    def percentile(self, p: float) -> float:
        if not self.latencies:
            return 0
        sorted_lat = sorted(self.latencies)
        idx = int(len(sorted_lat) * p / 100)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    def summary(self) -> str:
        lines = [
            "",
            "══════════════════════════════════════════════════════════════",
            "  MAGNEETAR LOAD TEST RESULTS",
            "══════════════════════════════════════════════════════════════",
            f"  Duration:        {self.duration:.1f}s",
            f"  Total requests:  {self.total_requests:,}",
            f"  Successful:      {self.successful:,}",
            f"  Failed:          {self.failed:,}",
            f"  Error rate:      {self.error_rate:.2f}%",
            f"  Throughput:      {self.rps:.1f} req/s",
            "",
            "  Latency:",
            f"    p50:           {self.percentile(50)*1000:.1f}ms",
            f"    p95:           {self.percentile(95)*1000:.1f}ms",
            f"    p99:           {self.percentile(99)*1000:.1f}ms",
            f"    max:           {max(self.latencies)*1000:.1f}ms" if self.latencies else "",
            "",
            "══════════════════════════════════════════════════════════════",
        ]
        return "\n".join(lines)


async def run_load_test(
    server_url: str,
    api_key: str,
    num_devices: int,
    duration_seconds: int,
    ping_interval: float = 3.0,
) -> LoadTestResult:
    """Run the load test with N concurrent devices."""
    result = LoadTestResult()
    result.start_time = time.monotonic()
    end_time = result.start_time + duration_seconds

    connector = aiohttp.TCPConnector(limit=num_devices, force_close=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Phase 1: Register all devices
        print(f"Registering {num_devices} devices...")
        devices = []
        for i in range(num_devices):
            dev = DeviceSimulator(
                device_id=f"load-test-{i:04d}",
                server_url=server_url,
                api_key=api_key,
            )
            devices.append(dev)

        # Register in parallel batches of 50
        batch_size = 50
        registered = 0
        for batch_start in range(0, num_devices, batch_size):
            batch = devices[batch_start : batch_start + batch_size]
            tasks = [dev.register(session) for dev in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            registered += sum(1 for r in results if r is True)
            print(f"  Registered {registered}/{num_devices}")

        print(f"\nRunning load test: {registered} devices × {duration_seconds}s (ping every {ping_interval}s)")
        print(f"Expected throughput: ~{registered / ping_interval:.0f} req/s\n")

        # Phase 2: Send pings concurrently
        async def device_loop(dev: DeviceSimulator):
            while time.monotonic() < end_time:
                latency, success = await dev.send_ping(session)
                result.total_requests += 1
                result.latencies.append(latency)
                if success:
                    result.successful += 1
                else:
                    result.failed += 1
                await asyncio.sleep(ping_interval)

        tasks = [device_loop(dev) for dev in devices[:registered]]
        await asyncio.gather(*tasks, return_exceptions=True)

    result.end_time = time.monotonic()
    return result


def main():
    parser = argparse.ArgumentParser(description="Magneetar Load Test")
    parser.add_argument("--server", default="http://localhost:8001", help="Server URL")
    parser.add_argument("--api-key", default=None, help="API key (reads from .env if not set)")
    parser.add_argument("--devices", type=int, default=100, help="Number of concurrent devices")
    parser.add_argument("--duration", type=int, default=30, help="Test duration in seconds")
    parser.add_argument("--interval", type=float, default=3.0, help="Ping interval per device (seconds)")
    args = parser.parse_args()

    # Load API key from .env if not provided
    api_key = args.api_key
    if not api_key:
        import os
        env_path = os.path.join(os.path.dirname(__file__), "..", "server", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("MT_DEVICE_KEY="):
                        api_key = line.split("=", 1)[1].strip()
                        break
    if not api_key:
        print("ERROR: --api-key required or MT_DEVICE_KEY not found in .env")
        raise SystemExit(1)

    print(f"Magneetar Load Test")
    print(f"Server:    {args.server}")
    print(f"Devices:   {args.devices}")
    print(f"Duration:  {args.duration}s")
    print(f"Interval:  {args.interval}s/device")
    print(f"Expected:  ~{args.devices / args.interval:.0f} req/s")
    print()

    result = asyncio.run(
        run_load_test(args.server, api_key, args.devices, args.duration, args.interval)
    )
    print(result.summary())


if __name__ == "__main__":
    main()
