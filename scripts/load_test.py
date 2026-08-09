#!/usr/bin/env python3
"""
Magneetar Load Testing Script
Tests server capacity under concurrent load to identify breaking points.

Usage:
    python3 scripts/load_test.py --url http://localhost:8000 --concurrent 100 --duration 60

This script helps answer: "What happens when a few thousand people register today?"
"""

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass
from typing import List

import httpx


@dataclass
class TestResult:
    """Result of a single request."""
    status_code: int
    latency_ms: float
    success: bool
    error: str = None


@dataclass
class LoadTestReport:
    """Summary of load test results."""
    total_requests: int
    successful_requests: int
    failed_requests: int
    success_rate: float
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    requests_per_second: float
    duration_seconds: float
    errors: List[str]


async def make_request(client: httpx.AsyncClient, url: str, endpoint: str, headers: dict = None) -> TestResult:
    """Make a single HTTP request and measure latency."""
    start = time.monotonic()
    try:
        response = await client.get(f"{url}{endpoint}", headers=headers, timeout=10)
        latency_ms = (time.monotonic() - start) * 1000
        return TestResult(
            status_code=response.status_code,
            latency_ms=latency_ms,
            success=200 <= response.status_code < 500,
        )
    except Exception as e:
        latency_ms = (time.monotonic() - start) * 1000
        return TestResult(
            status_code=0,
            latency_ms=latency_ms,
            success=False,
            error=str(e),
        )


async def load_test_health(client: httpx.AsyncClient, url: str, requests_per_second: int, duration: int) -> List[TestResult]:
    """Load test the health endpoint."""
    results = []
    interval = 1.0 / requests_per_second

    start_time = time.time()
    while time.time() - start_time < duration:
        result = await make_request(client, url, "/health")
        results.append(result)
        await asyncio.sleep(interval)

    return results


async def load_test_device_register(client: httpx.AsyncClient, url: str, api_key: str, concurrent: int, duration: int) -> List[TestResult]:
    """Load test device registration endpoint."""
    results = []

    async def worker():
        while time.time() - start_time < duration:
            import uuid
            device_id = f"load-test-{uuid.uuid4().hex[:8]}"
            try:
                start = time.monotonic()
                response = await client.post(
                    f"{url}/api/device/register",
                    json={"device_id": device_id, "model": "LoadTest"},
                    headers={"x-api-key": api_key},
                    timeout=10,
                )
                latency_ms = (time.monotonic() - start) * 1000
                results.append(TestResult(
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    success=200 <= response.status_code < 500,
                ))
            except Exception as e:
                latency_ms = (time.monotonic() - start) * 1000
                results.append(TestResult(
                    status_code=0,
                    latency_ms=latency_ms,
                    success=False,
                    error=str(e),
                ))
            await asyncio.sleep(0.1)  # Small delay between requests

    start_time = time.time()
    tasks = [worker() for _ in range(concurrent)]
    await asyncio.gather(*tasks)

    return results


def calculate_report(results: List[TestResult], duration: float) -> LoadTestReport:
    """Calculate load test report from results."""
    if not results:
        return LoadTestReport(
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            success_rate=0,
            avg_latency_ms=0,
            p50_latency_ms=0,
            p95_latency_ms=0,
            p99_latency_ms=0,
            min_latency_ms=0,
            max_latency_ms=0,
            requests_per_second=0,
            duration_seconds=duration,
            errors=[],
        )

    latencies = [r.latency_ms for r in results]
    errors = [r.error for r in results if r.error]

    return LoadTestReport(
        total_requests=len(results),
        successful_requests=sum(1 for r in results if r.success),
        failed_requests=sum(1 for r in results if not r.success),
        success_rate=sum(1 for r in results if r.success) / len(results) * 100,
        avg_latency_ms=statistics.mean(latencies),
        p50_latency_ms=statistics.median(latencies),
        p95_latency_ms=latencies[int(len(latencies) * 0.95)] if len(latencies) >= 20 else max(latencies),
        p99_latency_ms=latencies[int(len(latencies) * 0.99)] if len(latencies) >= 100 else max(latencies),
        min_latency_ms=min(latencies),
        max_latency_ms=max(latencies),
        requests_per_second=len(results) / duration,
        duration_seconds=duration,
        errors=errors[:10],  # Only first 10 errors
    )


def print_report(report: LoadTestReport, test_name: str):
    """Print a formatted load test report."""
    print(f"\n{'='*60}")
    print(f"LOAD TEST REPORT: {test_name}")
    print(f"{'='*60}")
    print(f"Duration:           {report.duration_seconds:.1f} seconds")
    print(f"Total Requests:     {report.total_requests}")
    print(f"Successful:         {report.successful_requests}")
    print(f"Failed:             {report.failed_requests}")
    print(f"Success Rate:       {report.success_rate:.1f}%")
    print(f"Requests/Second:    {report.requests_per_second:.1f}")
    print(f"{'─'*60}")
    print(f"Latency Statistics:")
    print(f"  Average:          {report.avg_latency_ms:.1f} ms")
    print(f"  P50 (median):     {report.p50_latency_ms:.1f} ms")
    print(f"  P95:              {report.p95_latency_ms:.1f} ms")
    print(f"  P99:              {report.p99_latency_ms:.1f} ms")
    print(f"  Min:              {report.min_latency_ms:.1f} ms")
    print(f"  Max:              {report.max_latency_ms:.1f} ms")
    print(f"{'='*60}")

    if report.errors:
        print(f"\nSample Errors ({len(report.errors)} shown):")
        for error in report.errors[:5]:
            print(f"  - {error[:100]}")

    # Capacity estimation
    if report.requests_per_second > 0:
        estimated_devices = int(report.requests_per_second * 3)  # 3 second intervals
        print(f"\n{'─'*60}")
        print(f"CAPACITY ESTIMATION:")
        print(f"  Current capacity:  ~{estimated_devices} devices (at 3s intervals)")
        print(f"  With optimizations: ~{estimated_devices * 2} devices (with caching)")
        print(f"  With PostgreSQL:   ~{estimated_devices * 10} devices (horizontal scaling)")
        print(f"{'─'*60}")


async def main():
    parser = argparse.ArgumentParser(description="Magneetar Load Testing")
    parser.add_argument("--url", default="http://localhost:8000", help="Server URL")
    parser.add_argument("--api-key", help="API key for authenticated endpoints")
    parser.add_argument("--concurrent", type=int, default=10, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=30, help="Test duration in seconds")
    parser.add_argument("--endpoint", choices=["health", "register", "all"], default="health", help="Endpoint to test")
    args = parser.parse_args()

    print(f"Starting load test against {args.url}")
    print(f"Concurrent users: {args.concurrent}")
    print(f"Duration: {args.duration} seconds")
    print(f"Endpoint: {args.endpoint}")

    async with httpx.AsyncClient() as client:
        # Test health endpoint
        if args.endpoint in ["health", "all"]:
            print("\nTesting /health endpoint...")
            results = await load_test_health(client, args.url, args.concurrent, args.duration)
            report = calculate_report(results, args.duration)
            print_report(report, "Health Endpoint")

        # Test device registration
        if args.endpoint in ["register", "all"] and args.api_key:
            print("\nTesting /api/device/register endpoint...")
            results = await load_test_device_register(client, args.url, args.api_key, args.concurrent, args.duration)
            report = calculate_report(results, args.duration)
            print_report(report, "Device Registration")
        elif args.endpoint == "register" and not args.api_key:
            print("\nSkipping /api/device/register - no API key provided")

    print("\nLoad test completed!")


if __name__ == "__main__":
    asyncio.run(main())
