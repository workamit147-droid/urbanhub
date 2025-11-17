import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

dotenv.config();

connectDB();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://urban-hub-frontend.vercel.app",
      "https://urbanhub-front.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/auth", (await import("./routes/auth.routes.js")).default);
app.use("/products", (await import("./routes/product.routes.js")).default);
app.use("/orders", (await import("./routes/order.routes.js")).default);
app.use("/admin", (await import("./routes/admin.routes.js")).default);
app.use("/admin/coupons", (await import("./routes/coupon.routes.js")).default);
app.use(
  "/admin/orders",
  (await import("./routes/orderManagement.routes.js")).default
);
app.use(
  "/admin/users",
  (await import("./routes/userManagement.routes.js")).default
);
app.use(
  "/admin/invoices",
  (await import("./routes/invoice.routes.js")).default
);
app.use("/banners", (await import("./routes/banner.routes.js")).default);
app.use("/cart", (await import("./routes/cart.routes.js")).default);

app.listen(5000, () => console.log("Server Running"));
