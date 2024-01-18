import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiErrors.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const refreshToken = user.generateRefreshToken();
        const acessToken = user.generateAccessToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { acessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //get user details from frontend

    const { fullname, email, username, password } = req.body

    //validation - not empty

    if ([fullname, email, username, password].some((field) => {
        field?.trim() === ""
    })) {
        throw new ApiError(400, "All fields are required");
    }

    //check if already exists

    const userExists = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (userExists) {
        throw new ApiError(409, "Email or username already exists");
    }

    //check for image upload / avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath= req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    //upload to cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }

    //create user object - create entry in db

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    //remove password and refresh token field from response

    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    //check for user creation

    if (!userCreated) {
        throw new ApiError(500, "Something went wrong while creating user");
    }

    //return res

    return res.status(201).json(
        new ApiResponse(200, userCreated, "User registered succesfully")
    );

});

const loginUser = asyncHandler(async (req, res) => {
    //req body --> data
    const { email, username, password } = req.body;

    //username or email
    if (!username && !email) {
        throw new ApiError(400), "username or email is required";
    }

    //find the user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (!user) {
        throw new ApiError(404, "No such user found");
    }

    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Password incorrect");
    }
    //access and refresh token
    const { acessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(-password - refreshToken);

    //send cookies(tokens)
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .cookie("acessToken", acessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, acessToken, refreshToken
                },
                "User logged in succesfully"
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(req.user._id, {
        $set: {
            refreshToken: undefined
        }
    }, {
        new: true
    })

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"))


});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefeshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefeshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {

        const decodedToken = jwt.verify(
            incomingRefeshToken,
            process.env.REFRESH_TOKEN
        )

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefeshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired");
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken)
            .cookie("refreshToken", newRefreshToken)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            )
    } catch (error) {
            throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken
};