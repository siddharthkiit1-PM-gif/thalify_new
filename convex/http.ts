import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { verify, inbound as whatsappInbound } from "./whatsapp/webhook";
import { inbound as telegramInbound } from "./telegram/webhook";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/whatsapp/webhook", method: "GET", handler: verify });
http.route({ path: "/whatsapp/webhook", method: "POST", handler: whatsappInbound });
http.route({ path: "/telegram/webhook", method: "POST", handler: telegramInbound });
export default http;
