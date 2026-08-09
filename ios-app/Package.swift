// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "Magneetar",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "MagneetarCore",
            targets: ["MagneetarCore"]
        ),
        .library(
            name: "MagneetarUI",
            targets: ["MagneetarUI"]
        )
    ],
    dependencies: [
        // Networking
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),

        // Keychain
        .package(url: "https://github.com/evgenyneu/keychain-swift.git", from: "22.0.0"),

        // WebSocket
        .package(url: "https://github.com/stormnate/StormWebsocket.git", from: "0.2.0")
    ],
    targets: [
        .target(
            name: "MagneetarCore",
            dependencies: [
                "Alamofire",
                "KeychainSwift",
                "StormWebsocket"
            ]
        ),
        .target(
            name: "MagneetarUI",
            dependencies: ["MagneetarCore"]
        ),
        .testTarget(
            name: "MagneetarCoreTests",
            dependencies: ["MagneetarCore"]
        )
    ]
)
