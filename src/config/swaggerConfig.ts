import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express API with Swagger",
      version: "1.0.0",
      description: "A simple Express API application documented with Swagger",
    },
    servers: [
      {
        url: "https://localhost:5000",
      },
    ],
  },
  apis: ["./src/controllers/*.ts"], // Path to the API docs
};

const specs = swaggerJsdoc(options);

export default specs;
