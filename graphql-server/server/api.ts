import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema.js";
import { Client } from "pg";
import env from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

env.config();

const saltRounds = 12;
const JWT_SECRET = "TOPSECRETKEY";

const db = new Client({
    user: process.env.USER_DB,
    password: process.env.PASSWORD_DB,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: 5432,
});

db.connect();

const resolvers = {
    Query: {
        user: (_: any, args: any, context: any) => {
            if (!context.id) {
                throw new Error("Not authenticated!");
            }
            return { id: context.id, email: context.email };
        },
        todos: async (_: any, args: any, context: any) => {
            if (!context.id) {
                throw new Error("Not authenticated!");
            }
            const resultOfQuery = await db.query("SELECT * FROM todos WHERE id=$1", [context.id]);
            const todos = [];
            for (let i = 0; i < resultOfQuery.rows.length; i++) {
                todos.push({ id: context.id, id_todo: resultOfQuery.rows[i].id_todo, title: resultOfQuery.rows[i].title, completed: resultOfQuery.rows[i].completed });
            }
            return todos;
        }
    },
    Mutation: {
        login: async (_: any, args: any) => {
            const email = args.email;
            const password = args.password;
            const resultOfQuery = await db.query("SELECT * FROM users WHERE email=$1", [email]);
            if (resultOfQuery.rows.length === 0) {
                return { success: false, message: "Email doesn't exist. Register instead" };
            } else {
                if (await comparePasswords(password, resultOfQuery.rows[0].password)) {
                    const token = generateToken(resultOfQuery.rows[0].id, resultOfQuery.rows[0].email);
                    return { success: true, message: "Login successful", user: { id: resultOfQuery.rows[0].id, email: resultOfQuery.rows[0].email } };
                } else {
                    return { success: false, message: "Password is incorrect" };
                }
            }
        },
        register: async (_: any, args: any) => {
            const email = args.email;
            const password = args.password;
            const confirmation_password = args.confirmation_password;
            const resultOfQuery = await db.query("SELECT * FROM users WHERE email=$1", [email]);
            if (resultOfQuery.rows.length === 0) {
                if (password === confirmation_password) {
                    const hashedPassword = await hashPassword(password);
                    const q = await db.query("SELECT * FROM users");
                    const id = q.rows.length + 1;
                    await db.query("INSERT INTO users VALUES ($1, $2, $3)", [id, email, hashedPassword]);
                    const token = generateToken(id, email);
                    return { success: true, message: "Registration successful", user: { id: id, email: email } };
                } else {
                    return { success: false, message: "Password and confirmation password must match" };
                }
            } else {
                return { success: false, message: "Email already in use. Try logging in instead" };
            }
        },
        deleteToDo: async (_: any, args: any, context: any) => {
            const id_todo = args.id_todo;
            if (!context.id) {
                throw new Error("Not authenticated!");
            }
            await db.query("DELETE FROM todos WHERE id_todo=$1", [id_todo]);
            const resultOfQuery = await db.query("SELECT * FROM todos WHERE id=$1", [context.id]);
            const todos = [];
            for (let i = 0; i < resultOfQuery.rows.length; i++) {
                todos.push({ id: context.id, id_todo: resultOfQuery.rows[i].id_todo, title: resultOfQuery.rows[i].title, completed: resultOfQuery.rows[i].completed });
            }
            return todos;
        },
        insertToDo: async (_: any, args: any, context: any) => {
            const title = args.title;
            if (!context.id) {
                throw new Error("Not authenticated!");
            }
            await db.query("INSERT INTO todos (id, title, completed) VALUES ($1, $2, $3)", [context.id, title, false]);
            const resultOfQuery = await db.query("SELECT * FROM todos WHERE id=$1", [context.id]);
            const todos = [];
            for (let i = 0; i < resultOfQuery.rows.length; i++) {
                todos.push({ id: context.id, id_todo: resultOfQuery.rows[i].id_todo, title: resultOfQuery.rows[i].title, completed: resultOfQuery.rows[i].completed });
            }
            return todos;
        },
        toggleToDoCompleted: async (_: any, args: any, context: any) => {
            const id_todo = args.id_todo;
            if (!context.id) {
                throw new Error("Not Authenticated!");
            }
            const resultOfQuery = await db.query("SELECT * FROM todos WHERE id_todo=$1", [id_todo]);
            if (resultOfQuery.rows[0].completed === true) {
                await db.query("UPDATE todos SET completed=$1 WHERE id_todo=$2", [false, id_todo]);
            } else {
                await db.query("UPDATE todos SET completed=$1 WHERE id_todo=$2", [true, id_todo]);
            }
            const todos = [];
            for (let i = 0; i < resultOfQuery.rows.length; i++) {
                todos.push({ id: context.id, id_todo: resultOfQuery.rows[i].id_todo, title: resultOfQuery.rows[i].title, completed: resultOfQuery.rows[i].completed });
            }
            return todos;
        }
    }
};

const server = new ApolloServer({
    typeDefs,
    resolvers
});

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => {
        const auth = req.headers.authorization || "";
        const token = auth.replace("Bearer ", "");
        const user = token ? verifyToken(token) : null;
        return { id: user?.id, email: user?.email };
    },
});

console.log(`Server running on ${url}`);

async function comparePasswords(enteredPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(enteredPassword, hashedPassword);
}

async function hashPassword(enteredPassword: string): Promise<string> {
    return bcrypt.hash(enteredPassword, saltRounds);
}

function generateToken(userId: number, userEmail: string): string {
    return jwt.sign({ id: userId, email: userEmail }, JWT_SECRET, { expiresIn: "1h" });
}

function verifyToken(token: string): { id: number, email: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { id: number, email: string };
    } catch (error) {
        return null;
    }
}