declare module "express-session" {
    interface SessionData {
        user?: {
            id: number;
            email: string;
        };
    }
}
export {};
//# sourceMappingURL=server.d.ts.map