import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiErrors.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/fileUpload.js";
import {ApiResponse} from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req,res)=>{
    //get user details from frontend

    const {fullname,email,username,password} = req.body

    //validation - not empty

    if([fullname,email,username,password].some((field)=>{
        field?.trim()===""
    })){
        throw new ApiError(400,"All fields are required");
    }

    //check if already exists

    const userExists = User.findOne({
        $or:[{ username },{ email }]
    });

    if(userExists){
        throw new ApiError(409,"Email or username already exists");
    }

    //check for image upload / avatar

    const avatarLocalPath= req.files?.avatar[0]?.path;
    const coverImageLocalPath= req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }

    //upload to cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar file is required");
    }

    //create user object - create entry in db

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username:username.tolowercase()
    });

    //remove password and refresh token field from response

    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken" 
    );

    //check for user creation

    if(!userCreated){
        throw new ApiError(500,"Something went wrong while creating user");
    }

    //return res

    return res.status(201).json(
        new ApiResponse(200,userCreated,"USer registered succesfully")
    );

});

export {registerUser};