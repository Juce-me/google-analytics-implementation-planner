import { prisma } from "../../lib/prisma";

export async function createAccount(formData: FormData) {
  const email = String(formData.get("email") || "");
  const method = String(formData.get("method") || "password");

  const user = await prisma.user.create({
    data: { email, signupMethod: method },
  });

  return { userId: user.id, method };
}
