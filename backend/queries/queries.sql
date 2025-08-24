/* Query to select the correct password if it exists */
SELECT * FROM users WHERE email=$1

/* Query to check whether the user already exists during registration */
SELECT * FROM users WHERE email=$1

/* Query to insert a new user into the users table */
INSERT INTO users VALUES ($1, $2, $3)

/* Query to select the To Dos of the specified user */
SELECT * FROM todos WHERE id=$1

/* Query to insert a new note */
INSERT INTO todos (id, title, completed) VALUES ($1, $2, $3)

/* Remove the query of interest */
DELETE FROM todos WHERE id_todo=$1

/* Query to update the completed flag */
UPDATE todos SET completed=$1 WHERE id_todo=$2