# docker-modem-mock

[![npm version](https://img.shields.io/npm/v/docker-modem-mock.svg)](https://www.npmjs.com/package/docker-modem-mock)
[![Publish](https://github.com/kearisp/docker-modem-mock/actions/workflows/publish-latest.yml/badge.svg?event=release)](https://github.com/kearisp/docker-modem-mock/actions/workflows/publish-latest.yml)
[![License](https://img.shields.io/npm/l/docker-modem-mock)](https://github.com/kearisp/docker-modem-mock/blob/master/LICENSE)

[![npm total downloads](https://img.shields.io/npm/dt/docker-modem-mock.svg)](https://www.npmjs.com/package/docker-modem-mock)
[![bundle size](https://img.shields.io/bundlephobia/minzip/docker-modem-mock)](https://bundlephobia.com/package/docker-modem-mock)
![Coverage](https://gist.githubusercontent.com/kearisp/f17f46c6332ea3bb043f27b0bddefa9f/raw/coverage-docker-modem-mock-latest.svg)

A mock implementation of `docker-modem` for testing purposes. This package allows you to mock Docker API calls in your tests when your code interacts with Docker (e.g., creating containers), but you don't need a real Docker daemon or to test the actual container contents.

## Features

- **Image Management**: Pulling, building, listing, inspecting, and deleting images.
- **Container Lifecycle**: Creating, starting, stopping, listing, and inspecting containers.
- **Fixture-based Responses**: Use pre-recorded or custom fixtures to simulate Docker API responses for complex operations like `pull` and `build`.
- **Dockerode Integration**: Seamlessly works with `dockerode` by replacing its underlying modem.

## Installation

```bash
npm install docker-modem-mock --save-dev
```

## Usage

### Basic Setup with Dockerode

```typescript
import Docker from "dockerode";
import { ModemMock, Fixtures } from "docker-modem-mock";

const docker = new Docker({
    modem: new ModemMock({
        mockFixtures: Fixtures.fromPath("./test/fixtures")
    })
});
```

### Pulling an Image

```typescript
const stream = await docker.pull("node:18");
stream.on("data", (chunk) => console.log(chunk.toString()));
stream.on("end", () => console.log("Pull complete"));
```

### Building an Image

```typescript
const stream = await docker.buildImage({
    context: "./path/to/context",
    src: ["Dockerfile", "index.js"]
}, {
    t: "my-image:latest"
});
```

### Container Lifecycle

```typescript
const container = await docker.createContainer({
    Image: "node:18",
    name: "my-container"
});

await container.start();
const inspect = await container.inspect();

console.log(inspect.State.Status); // "running"

await container.stop();
```

## Fixtures Structure

The mock relies on a specific directory structure for fixtures:

- `records/{version}/image/{imageName}/{tag}.json`: JSON file containing image inspection data.
- `records/{version}/pull/{imageName}/{tag}.jsonl`: JSONL file containing streaming output for image pull.
- `records/{version}/build-{builderVersion}/{imageName}/{tag}.jsonl`: JSONL file containing streaming output for image build.

## Fixtures recorder

Currently, fixtures must be recorded manually; a dedicated command for this will be created in the future.

For now, you can use the following script for this purpose:

```typescript
import Docker from "dockerode";
import { ModemRecorder, Fixtures } from "docker-modem-mock";
import Path from "path";

const docker = new Docker({
    modem: new ModemRecorder({
        recordFixtures: Fixtures.fromPath(Path.resolve("./your-fixtures-dir")),
        // Docker modem setting:
        socketPath: "/var/run/docker.sock"
    })
});

const image = docker.getImage("node:23");

await image.remove().catch(() => undefined);

const stream = await docker.pull("node:23");

stream.on("data", (chunk) => process.stdout.write(chunk.toString()));
stream.on("end", async () => {
    console.log(await image.inspect());
});
```

This script will record the pull response for the image to the `your-fixtures-dir/records/v1/pull/node/23.jsonl` file.

## API

### `ModemMock`

Inherits from `Modem`.

- `constructor(options: Options)`
  - `mockFixtures`: Optional `Fixtures` instance to load initial data.
- `registerFixtures(fixtures: Fixtures)`: Registers additional fixtures.
- `reset()`: Resets the internal state (containers and images).

### `Fixtures`

- `static fromPath(path: string)`: Creates a `Fixtures` instance from a filesystem path.
- `static fromFS(fs: FileSystem)`: Creates a `Fixtures` instance from a `docker-modem-mock` FileSystem.

## License

MIT
