# docker-modem-mock

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

## API

### `ModemMock`

Inherits from `Modem`.

- `constructor(options: Options)`
  - `mockFixtures`: Optional `Fixtures` instance to load initial data.
- `registerFixtures(fixtures: Fixtures)`: Registers additional fixtures.
- `reset()`: Resets the internal state (containers and images).

### `Fixtures`

- `static fromPath(path: string)`: Creates a `Fixtures` instance from a filesystem path.
- `static fromFS(fs: FileSystem)`: Creates a `Fixtures` instance from a `@wocker/core` FileSystem.

## License

MIT
