import sendEmail from "../config/sendEmail.js";
import UserModel from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import verifyEmailTemplate from "../utils/verifyEmailTemplate.js";
import generatedAccessToken from "../utils/generatedAccessToken.js";
import genertedRefreshToken from "../utils/generatedRefreshToken.js";
import uploadImageClodinary from "../utils/uploadImageClodinary.js";
import generatedOtp from "../utils/generatedOtp.js";
import forgotPasswordTemplate from "../utils/forgotPasswordTemplate.js";
import jwt from "jsonwebtoken";

/* ======================================================
   REGISTER USER
====================================================== */
export async function registerUserController(request, response) {
  try {
    const { name, email, password } = request.body;

    if (!name || !email || !password) {
      return response.status(400).json({
        message: "Provide name, email, password",
        error: true,
        success: false,
      });
    }

    const user = await UserModel.findOne({ email });

    if (user) {
      return response.json({
        message: "Email already registered",
        error: true,
        success: false,
      });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashPassword = await bcryptjs.hash(password, salt);

    const newUser = await UserModel.create({
      name,
      email,
      password: hashPassword,
    });

    const verifyEmailUrl = `${process.env.FRONTEND_URL}/verify-email?code=${newUser._id}`;

    await sendEmail({
      sendTo: email,
      subject: "Verify Email",
      html: verifyEmailTemplate({
        name,
        url: verifyEmailUrl,
      }),
    });

    return response.json({
      message: "User registered successfully",
      success: true,
      error: false,
      data: newUser,
    });
  } catch (error) {
    return response.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
}

/* ======================================================
   LOGIN CONTROLLER ⭐ FIXED
====================================================== */
export async function loginController(request, response) {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).json({
        message: "Provide email and password",
        error: true,
        success: false,
      });
    }

    const user = await UserModel.findOne({ email });

    if (!user) {
      return response.status(400).json({
        message: "User not registered",
        error: true,
        success: false,
      });
    }

    const checkPassword = await bcryptjs.compare(
      password,
      user.password
    );

    if (!checkPassword) {
      return response.status(400).json({
        message: "Incorrect password",
        error: true,
        success: false,
      });
    }

    const accessToken = await generatedAccessToken(user._id);
    const refreshToken = await genertedRefreshToken(user._id);

    await UserModel.findByIdAndUpdate(user._id, {
      last_login_date: new Date(),
    });

    /* ⭐ COOKIE CONFIG (Render + Vercel FIX) */
    const isProduction = process.env.NODE_ENV === "production";

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
    };

    response.cookie("accessToken", accessToken, cookieOptions);
    response.cookie("refreshToken", refreshToken, cookieOptions);

    return response.json({
      message: "Login successful",
      success: true,
      error: false,
    });
  } catch (error) {
    return response.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
}

/* ======================================================
   LOGOUT
====================================================== */
export async function logoutController(request, response) {
  try {
    response.clearCookie("accessToken");
    response.clearCookie("refreshToken");

    return response.json({
      message: "Logout successful",
      success: true,
      error: false,
    });
  } catch (error) {
    return response.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
}

/* ======================================================
   REFRESH TOKEN ⭐ FIXED
====================================================== */
export async function refreshToken(request, response) {
  try {
    const token =
      request.cookies?.refreshToken ||
      (request.headers.authorization
        ? request.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return response.status(401).json({
        message: "Refresh token missing",
        error: true,
        success: false,
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.SECRET_KEY_REFRESH_TOKEN
    );

    const newAccessToken = await generatedAccessToken(decoded.id);

    const isProduction = process.env.NODE_ENV === "production";

    response.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
    });

    return response.json({
      message: "New access token generated",
      success: true,
      error: false,
    });
  } catch (error) {
    return response.status(401).json({
      message: "Session expired",
      error: true,
      success: false,
    });
  }
}

/* ======================================================
   USER DETAILS
====================================================== */
export async function userDetails(request, response) {
  try {
    const user = await UserModel.findById(request.userId).select(
      "-password"
    );

    return response.json({
      message: "User details",
      success: true,
      error: false,
      data: user,
    });
  } catch (error) {
    return response.status(500).json({
      message: "Something went wrong",
      error: true,
      success: false,
    });
  }
}
