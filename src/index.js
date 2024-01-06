import dotenv from "dotenv";
import connectDB from "./db/db.js";
import {app} from "./app.js";

dotenv.config({
    path: './env'
})

connectDB()
    .then(()=>{
        app.listen(process.env.PORT,()=>{
            console.log(`server is running at : ${process.env.PORT}`)
        })
    })
    .catch((err) => {
        console.log("mongoDB connection failed!!", err);
    })

/*
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

(async()=>{
     try{
        mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

        app.on("error",(error)=>{
            console.log("err:", error);
            throw err;
        });

        app.listen(process.env.port,()=>{
            console.log(`App is listening on port ${port}`);
        })
     }catch(error){
           console.error("Error:",error);
           throw error;
     }
})();
*/
