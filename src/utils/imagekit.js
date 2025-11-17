import ImageKit from "imagekit";
import multer from "multer";

const imagekit = new ImageKit({
  publicKey: "public_veGsZGok0mqS6mAzR9X3HrCYF4c=",
  privateKey: "private_0JElVzL/kZ5+T2DwLKp5d8ijN+U=",
  urlEndpoint: "https://ik.imagekit.io/ropaxjhgke",
});

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

export { imagekit, upload };
