import jwt from "jsonwebtoken";

const auth = async (request, response, next) => {
  try {
    /* ================= GET TOKEN ================= */

    // token from cookie (Vercel → Render)
    const cookieToken = request.cookies?.accessToken;

    // token from Authorization header (Postman / mobile apps)
    const headerToken = request.headers.authorization
      ? request.headers.authorization.split(" ")[1]
      : null;

    // use whichever exists
    const token = cookieToken || headerToken;

    /* ================= CHECK TOKEN ================= */

    if (!token) {
      return response.status(401).json({
        message: "Unauthorized - Token not provided",
        error: true,
        success: false,
      });
    }

    /* ================= VERIFY TOKEN ================= */

    const decoded = jwt.verify(
      token,
      process.env.SECRET_KEY_ACCESS_TOKEN
    );

    if (!decoded || !decoded.id) {
      return response.status(401).json({
        message: "Invalid token",
        error: true,
        success: false,
      });
    }

    /* ================= ATTACH USER ================= */

    request.userId = decoded.id;

    next();
  } catch (error) {
    /* ================= TOKEN ERROR ================= */

    return response.status(401).json({
      message: "Session expired, please login again",
      error: true,
      success: false,
    });
  }
};

export default auth;
