import mongoose from "mongoose";



async function connectDb(){
   
    try {
        const mongoUri= process.env.MONGO_URI;

        if(!mongoUri){
            throw new Error("MONGO_URI is required");
        }
        const conn =  await mongoose.connect(mongoUri);
        console.log("MongoDb connected", conn.connection.host);
        

    } catch (error) {
    
        console.log("MongoDb Connection Error", error.message);
        process.exit(201);
    }
}

export default connectDb;