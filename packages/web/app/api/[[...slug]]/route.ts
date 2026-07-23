import app from "@neo-id/api";

const handler = async (request: Request) => {
  return app.fetch(request);
};

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
