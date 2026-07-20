import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";

export async function userinfo(c: Context) {
  const user = c.get("user");

  const profile = await db.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      displayName: true,
      firstName: true,
      lastName: true,
      avatar: true,
    },
  });

  if (!profile) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  // OpenID Connect UserInfo response
  return success(c, {
    sub: profile.id,
    email: profile.email,
    email_verified: profile.emailVerified,
    name: profile.displayName,
    given_name: profile.firstName,
    family_name: profile.lastName,
    picture: profile.avatar,
  });
}
