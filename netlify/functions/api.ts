import app from "../../packages/api/src/app";

export default async (request: Request) => {
  return app.fetch(request);
};
