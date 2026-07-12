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
 * - GITHUB_ID
 * - GITHUB_SECRET
 *
 * Route handlers are added in Prompt 4 — do not import this from a route yet for handlers.
 */
export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    // GitHub OAuth placeholder — set GITHUB_ID / GITHUB_SECRET in .env
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
