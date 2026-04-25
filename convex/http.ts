import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { verify, inbound } from "./whatsapp/webhook";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/whatsapp/webhook", method: "GET", handler: verify });
http.route({ path: "/whatsapp/webhook", method: "POST", handler: inbound });
export default http;
