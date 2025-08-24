export const typeDefs = `#graphql
    type User {
        id: ID!,
        email: String!
    }
    type ToDo {
        id: ID!,
        id_todo: ID!,
        title: String!,
        completed: Boolean!
    }
    type LoginResponse {
        success: Boolean!,
        message: String!,
        user: User
    }   
    type RegisterResponse {
        success: Boolean!,
        message: String!,
        user: User
    }
    type Query {
        user: User,
        todos: [ToDo]
    }
    type Mutation {
        deleteToDo(id_todo: Int!): [ToDo],
        insertToDo(id_todo: Int!): [ToDo],
        toggleToDoCompleted(id_todo: Int!): [ToDo],
        login(email: String!, password: String!): LoginResponse,
        register(email: String!, password: String!, confirmation_password: String!): RegisterResponse
    }
`;
//# sourceMappingURL=schema.js.map