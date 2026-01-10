import uploadImageClodinary from "../utils/uploadImageClodinary.js";

const uploadImageController = async (req, res) => {
  try {
    const image = req.file;

    if (!image) {
      return res.status(400).json({
        message: "No image provided",
        error: true,
        success: false,
      });
    }

    const upload = await uploadImageClodinary(image);

    if (!upload || !upload.url) {
      return res.status(500).json({
        message: "Cloudinary upload failed",
        error: true,
        success: false,
      });
    }

    return res.json({
      message: "Image uploaded successfully",
      success: true,
      error: false,
      data: {
        url: upload.secure_url || upload.url,
      },
    });

  } catch (error) {
    console.log("UPLOAD ERROR :", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      error: true,
      success: false,
    });
  }
};

export default uploadImageController;
