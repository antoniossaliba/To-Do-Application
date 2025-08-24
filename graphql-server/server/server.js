import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Client } from "pg";
import connectPgSimple from "connect-pg-simple";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import env from "dotenv";
import session from "express-session";
env.config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const mainDirectory = __dirname.substring(0, 49);
const saltRounds = 12;
const app = express();
const PORT = 3000;
app.use(express.static(`${mainDirectory}/public`));
app.use(bodyParser.urlencoded({ extended: true }));
const db = new Client({
    user: process.env.USER_DB,
    password: process.env.PASSWORD_DB,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: 5432,
});
db.connect();
const PgSession = connectPgSimple(session);
app.use(session({
    store: new PgSession({
        conObject: {
            user: process.env.USER_DB,
            password: process.env.PASSWORD_DB,
            host: process.env.HOST,
            database: process.env.DATABASE,
            port: 5432
        },
        tableName: "session",
        createTableIfMissing: true
    }),
    secret: "TOPSECRETKEY",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 10,
        httpOnly: true },
    rolling: true // Cookie will be reset as if the user logged in / registered now
}));
app.get("/", (req, res) => {
    res.redirect("/login");
});
app.get("/logout", requireAuth, (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                res.redirect("/todos");
            }
            else {
                res.render(`${mainDirectory}/views/login.ejs`, { logout_message: "Logged out successfully." });
            }
        });
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.get("/login", (req, res) => {
    try {
        if (req.session.user) {
            res.redirect("/todos");
        }
        else {
            res.render(`${mainDirectory}/views/login.ejs`, { msg: "You are not authenticated. Register or log in first." });
        }
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again", error: error });
    }
});
app.post("/login", async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const resultOfQuery = await db.query("SELECT * FROM users WHERE email=$1", [email]);
        if (resultOfQuery.rows.length === 0) {
            res.render(`${mainDirectory}/views/login.ejs`, { emailMessage: "No email found. Try to register instead." });
        }
        else {
            if (await comparePasswords(password, resultOfQuery.rows[0].password)) {
                req.session.regenerate((err) => {
                    if (err) {
                        res.render(`${mainDirectory}/views/login.ejs`, { message: "Something went wrong. Please try again." });
                    }
                    req.session.user = { id: resultOfQuery.rows[0].id, email: resultOfQuery.rows[0].email };
                    res.redirect("/todos");
                });
            }
            else {
                res.render(`${mainDirectory}/views/login.ejs`, { passwordMessage: "Wrong password. Please try again." });
            }
        }
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.get("/register", (req, res) => {
    try {
        if (req.session.user) {
            res.redirect("/todos");
        }
        else {
            res.render(`${mainDirectory}/views/register.ejs`, { msg: "You are not authenticated. Register or log in first." });
        }
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.post("/register", async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const confirmPassword = req.body.confirm_password;
        const resultOfQuery = await db.query("SELECT * FROM users WHERE email=$1", [email]);
        if (resultOfQuery.rows.length === 0) {
            if (password === confirmPassword) {
                const hashedPassword = await hashPassword(password);
                const query = await db.query("SELECT * FROM users");
                const id = query.rows.length + 1;
                await db.query("INSERT INTO users VALUES ($1, $2, $3)", [id, email, hashedPassword]);
                req.session.regenerate((err) => {
                    if (err) {
                        res.render(`${mainDirectory}/views/register.ejs`, { message: "Something went wrong. Please try again." });
                    }
                    req.session.user = { id: id, email: email };
                    res.redirect("/todos");
                });
            }
            else {
                res.render(`${mainDirectory}/views/register.ejs`, { passwordMessage: "Password and confirmation password must match." });
            }
        }
        else {
            res.render(`${mainDirectory}/views/register.ejs`, { emailMessage: "Email already exists. Try logging in instead." });
        }
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.get("/todos", requireAuth, async (req, res) => {
    try {
        const id = req.session.user?.id;
        const todos = [];
        const id_todos = [];
        const completed = [];
        const todosOfInterest = await db.query("SELECT * FROM todos WHERE id=$1", [id]);
        for (let i = 0; i < todosOfInterest.rows.length; i++) {
            todos.push(todosOfInterest.rows[i].title);
            id_todos.push(todosOfInterest.rows[i].id_todo);
            completed.push(todosOfInterest.rows[i].completed);
        }
        res.render(`${mainDirectory}/views/todos.ejs`, { todos: todos, id_todos: id_todos, completed: completed });
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.post("/todos", requireAuth, async (req, res) => {
    try {
        const todo = req.body.new_note;
        const currentUserId = req.session.user?.id;
        await db.query("INSERT INTO todos (id, title, completed) VALUES ($1, $2, $3)", [currentUserId, todo, false]);
        res.redirect("/todos");
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.post("/todos/:id", requireAuth, async (req, res) => {
    try {
        const id_todo = req.params.id;
        await db.query("DELETE FROM todos WHERE id_todo=$1", [id_todo]);
        res.redirect("/todos");
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.post("/mark-completed/:id", requireAuth, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM todos WHERE id_todo=$1", [req.params.id]);
        if (result.rows[0].completed === true) {
            await db.query("UPDATE todos SET completed=$1 WHERE id_todo=$2", [false, req.params.id]);
        }
        else {
            await db.query("UPDATE todos SET completed=$1 WHERE id_todo=$2", [true, req.params.id]);
        }
        res.redirect("/todos");
    }
    catch (error) {
        res.sendStatus(503).json({ message: "Something went wrong. Please try again.", error: error });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
async function comparePasswords(enteredPassword, hashedPassword) {
    return bcrypt.compare(enteredPassword, hashedPassword);
}
async function hashPassword(enteredPassword) {
    return bcrypt.hash(enteredPassword, saltRounds);
}
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    }
    else {
        res.redirect("/login");
    }
}
//# sourceMappingURL=server.js.map