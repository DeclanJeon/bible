import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90 days
  },
  pages: {
    signIn: "/letters/join",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.googleId = profile?.sub;
        token.email = profile?.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.googleId as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});
