import {Controller, Post, Param, Query} from "../http";
import {HttpException} from "../exceptions/HttpException";
import {DockerStorage} from "../makes/DockerStorage";


type BuildQuery = {
    t: string;
    version?: string;
};

@Controller("/build")
export class BuildController {
    public constructor(
        protected readonly storage: DockerStorage
    ) {}

    @Post()
    public build(@Param("version") version: string = "v1", @Query() query: BuildQuery) {
        const {
            t: tag,
            version: builderVersion = "1"
        } = query;

        const [imageName, imageTag = "latest"] = tag.split(":");

        const fixture = this.storage.fixtures.find((fixture) => {
            return fixture.hasBuild(version, builderVersion, imageName, imageTag);
        });

        if(!fixture) {
            throw new HttpException(500, "Fixture not found");
        }

        const stream = fixture.build(version, builderVersion, imageName, imageTag);

        stream.on("end", (): void => {
            let image = this.storage.images.find((image) => {
                return image.RepoTags.includes(`${imageName}:${imageTag}`);
            });

            if(!image) {
                image = fixture.imageInspect(version, imageName, imageTag);
            }

            if(image) {
                image.Created = new Date(image.Created).getTime();
                this.storage.addImage(image);
            }
        });

        stream.on("error", () => undefined);

        return stream;
    }
}
