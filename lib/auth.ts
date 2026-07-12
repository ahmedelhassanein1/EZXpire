import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { MongoDBAdapter } from "@auth/mongodb-adapter";

import { clientPromise } from "@/lib/mongodb";

/**
 * Auth.js / NextAuth options (Person 1).
 *
 * Required env:
 * - MONGODB_URI
 * - AUTH_SECRET (or NEXTAUTH_SECRET)
 * - GITHUB_ID / GITHUB_SECRET
 * - NEXTAUTH_URL (e.g. http://localhost:3000)
 */
export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "database",
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
