# Docker API Method Support

This document lists all Docker API methods and parameters that can be mocked using this package.

## Containers

| Method                   | Endpoint                        | Supported Parameters                                                                            | Support Level |
|:-------------------------|:--------------------------------|:------------------------------------------------------------------------------------------------|:-------------:|
| **List Containers**      | `GET /containers/json`          | `all`, `filters` (name, status, label)                                                          |    🟢 80%     |
| **Create Container**     | `POST /containers/create`       | `Image`, `Labels`, `name` (query), `HostConfig.NetworkMode`, `NetworkingConfig.EndpointsConfig` |    🟡 70%     |
| **Inspect Container**    | `GET /containers/{id}/json`     | `id`                                                                                            |    🟢 95%     |
| **Start Container**      | `POST /containers/{id}/start`   | `id`                                                                                            |    🟢 100%    |
| **Stop Container**       | `POST /containers/{id}/stop`    | `id`, `t`                                                                                       |    🟢 100%    |
| **Restart Container**    | `POST /containers/{id}/restart` | `id`, `t`                                                                                       |    🟢 100%    |
| **Rename Container**     | `POST /containers/{id}/rename`  | `id`, `name` (query)                                                                            |    🟢 100%    |
| **Resize Container TTY** | `POST /containers/{id}/resize`  | `id`, `h`, `w`                                                                                  |    🟢 100%    |
| **Kill Container**       | `POST /containers/{id}/kill`    | `id`, `signal`                                                                                  |    🟢 100%    |
| **Pause Container**      | `POST /containers/{id}/pause`   | `id`                                                                                            |    🟢 100%    |
| **Unpause Container**    | `POST /containers/{id}/unpause` | `id`                                                                                            |    🟢 100%    |
| **Remove Container**     | `DELETE /containers/{id}`       | `id`, `v`, `force`, `link`                                                                      |    🟡 70%     |
| **List processes**       | `GET /containers/{id}/top`      | -                                                                                               |     🔴 0%     |
| **Get container logs**   | `GET /containers/{id}/logs`     | -                                                                                               |     🔴 0%     |
| **Get changes on FS**    | `GET /containers/{id}/changes`  | -                                                                                               |     🔴 0%     |
| **Export container**     | `GET /containers/{id}/export`   | -                                                                                               |     🔴 0%     |
| **Get container stats**  | `GET /containers/{id}/stats`    | -                                                                                               |     🔴 0%     |
| **Update container**     | `POST /containers/{id}/update`  | -                                                                                               |     🔴 0%     |
| **Wait container**       | `POST /containers/{id}/wait`    | -                                                                                               |     🔴 0%     |
| **Archive container**    | `GET /containers/{id}/archive`  | -                                                                                               |     🔴 0%     |
| **Extract to container** | `PUT /containers/{id}/archive`  | -                                                                                               |     🔴 0%     |
| **Prune containers**     | `POST /containers/prune`        | -                                                                                               |     🔴 0%     |

## Images

| Method            | Endpoint                  | Supported Parameters        |       Support Level        |
|:------------------|:--------------------------|:----------------------------|:--------------------------:|
| **List Images**   | `GET /images/json`        | `all`, `filters`, `digests` |           🟢 80%           |
| **Pull Image**    | `POST /images/create`     | `fromImage`, `tag`          | 🟡 50% (requires fixtures) |
| **Build Image**   | `POST /build`             | `t`, `version`              | 🟡 50% (requires fixtures) |
| **Inspect Image** | `GET /images/{name}/json` | `name`                      |           🟢 90%           |
| **Remove Image**  | `DELETE /images/{name}`   | `name`, `force`, `noprune`  |           🟡 70%           |
| **Get image history**| `GET /images/{name}/history` | -                        |           🔴 0%            |
| **Push image**    | `POST /images/{name}/push`| -                           |           🔴 0%            |
| **Tag image**     | `POST /images/{name}/tag` | -                           |           🔴 0%            |
| **Search images** | `GET /images/search`      | -                           |           🔴 0%            |
| **Prune images**  | `POST /images/prune`      | -                           |           🔴 0%            |
| **Commit container**| `POST /commit`          | -                           |           🔴 0%            |
| **Export image**  | `GET /images/{name}/get`  | -                           |           🔴 0%            |
| **Import image**  | `POST /images/load`       | -                           |           🔴 0%            |

## Networks

| Method                   | Endpoint                         | Supported Parameters                                                                             | Support Level  |
|:-------------------------|:---------------------------------|:-------------------------------------------------------------------------------------------------|:--------------:|
| **List networks**        | `GET /networks`                  | -                                                                                                |     🟡 60%     |
| **Inspect network**      | `GET /networks/{id}`             | `id`                                                                                             |     🟡 70%     |
| **Remove network**       | `DELETE /networks/{id}`          | -                                                                                                |     🔴 0%      |
| **Create network**       | `POST /networks/create`          | `Name`, `Driver`, `Internal`, `Attachable`, `Ingress`, `EnableIPv6`, `IPAM`, `Options`, `Labels` |     🟢 80%     |
| **Connect container**    | `POST /networks/{id}/connect`    | -                                                                                                |     🔴 0%      |
| **Disconnect container** | `POST /networks/{id}/disconnect` | -                                                                                                |     🔴 0%      |
| **Prune networks**       | `POST /networks/prune`           | -                                                                                                |     🔴 0%      |

## Volumes

| Method            | Endpoint                  | Supported Parameters | Support Level |
|:------------------|:--------------------------|:---------------------|:-------------:|
| **List volumes**  | `GET /volumes`            | -                    |     🔴 0%     |
| **Inspect volume**| `GET /volumes/{name}`     | -                    |     🔴 0%     |
| **Remove volume** | `DELETE /volumes/{name}`  | -                    |     🔴 0%     |
| **Create volume** | `POST /volumes/create`    | -                    |     🔴 0%     |
| **Prune volumes** | `POST /volumes/prune`     | -                    |     🔴 0%     |

## Exec

| Method            | Endpoint                      | Supported Parameters | Support Level |
|:------------------|:------------------------------|:---------------------|:-------------:|
| **Exec create**   | `POST /containers/{id}/exec`  | -                    |     🔴 0%     |
| **Exec start**    | `POST /exec/{id}/start`       | -                    |     🔴 0%     |
| **Exec inspect**  | `GET /exec/{id}/json`         | -                    |     🔴 0%     |
| **Exec resize**   | `POST /exec/{id}/resize`      | -                    |     🔴 0%     |

## Sessions

| Method             | Endpoint        | Supported Parameters  |     Support Level       |
|:-------------------|:----------------|:----------------------|:-----------------------:|
| **Create Session** | `POST /session` | -                     | 🟢 100% (Duplex stream) |

## System

| Method            | Endpoint                  | Supported Parameters | Support Level |
|:------------------|:--------------------------|:---------------------|:-------------:|
| **Check auth**    | `POST /auth`              | -                    |     🔴 0%     |
| **Get info**      | `GET /info`               | -                    |     🔴 0%     |
| **Get version**   | `GET /version`            | -                    |     🔴 0%     |
| **Ping**          | `GET /_ping`              | -                    |     🔴 0%     |
| **Events**        | `GET /events`             | -                    |     🔴 0%     |
| **Data usage**    | `GET /system/df`          | -                    |     🔴 0%     |

---

### Color Legend:
- 🟢 **80-100%**: Method is fully or almost fully implemented according to the Docker API.
- 🟡 **50-79%**: Basic implementation, only main parameters are supported, or functionality depends on fixtures.
- 🔴 **< 50%**: Minimal support or the method is only declared.
