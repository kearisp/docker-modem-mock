import {Duplex} from "stream";
import {Controller, Post} from "../http";


@Controller("/session")
export class SessionController {
    @Post()
    public create() {
        return new Duplex();
    }
}
