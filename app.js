const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const io = require("socket.io")(8080, {
  cors: {
    origin: "http://localhost:3000",
  },
});
const secretKey = "My_SECRET_KEY";

// Connect DB
require("./db/connection");

// Import Files
const User = require("./models/UserSchema");
const Message = require("./models/MessageSchema");

// app Use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const corsOptions ={
    origin:'*', 
    credentials:true,            
    optionSuccessStatus:200,
 }
 
 app.use(cors(corsOptions))

const port = 8000;

// Socket.io
let users = [];
io.on("connection", (socket) => {
  console.log("User connected", socket.id);
  socket.on("addUser", (userId) => {
    const isUserExist = users.find((user) => user.userId === userId);
    if (!isUserExist) {
      const user = { userId, socketId: socket.id };
      users.push(user);
      io.emit("getUsers", users);
    }
  });

  socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
    const receiver = users.find((user) => user.userId === receiverId);
    const sender = users.find((user) => user.userId === senderId);
    const user1 = await User.findById(senderId);
    const user2 = await User.findById(receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("getMessage", {
        senderId: user1,
        message,
        receiverId: user2,
      });
    } else {
      io.to(sender.socketId).emit("getMessage", {
        senderId: user1,
        message,
        receiverId: user2,
      });
    }
  });

  socket.on("disconnect", () => {
    users = users.filter((user) => user.socketId !== socket.id);
    io.emit("getUsers", users);
  });

  socket.on("logOut", (userId) => {
    users = users.filter((user) => user.userId !== userId);
    io.emit("getUsers", users);
  });
});

// Routes

const generateToken = (id) => {
  const token = jwt.sign(
    {
      id,
    },
    secretKey
  );
  return token;
};

const decodeToken = (token) => {
  let id;
  try {
    id = jwt.verify(token, secretKey);
    return id;
  } catch (err) {
    console.log("Error verifying token", err);
  }
};

const authenticateUser = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    // console.log(token);
    if (!token) {
      res.status(400).json({
        status: false,
        message: "Token not found",
      });
      return;
    }
    token = token.slice(0, token.length);
    const userId = decodeToken(token);

    if (!userId) {
      res.status(422).json({
        status: false,
        message: "Invalid Token",
      });
      return;
    }

    const user = await User.findById({ _id: userId.id }).select("-password");
    if (!user) {
      res.status(422).json({
        status: false,
        message: "Invalid Token",
      });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(400).json({ message: "Error authenticate user", error: err });
  }
};

app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ message: "all fields are required" });
      return;
    }

    const isAlreadyExist = await User.findOne({ email });
    if (isAlreadyExist) {
      res.status(400).json({ message: "User already exist" });
      return;
    }

    const newUser = await new User({ fullName, email });
    bcrypt.hash(password, 10, async (err, hashedPassword) => {
      newUser.set("password", hashedPassword);
      await newUser.save();
      res
        .status(200)
        .json({ user: {fullName: newUser.fullName, email: newUser.email, id: newUser._id}, message: "User registered successfully" });
    });
  } catch (err) {
    res.status(400).json({ message: "Error registering user", error: err });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: `All fields are required`,
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({
        message: `User not found`,
      });
      return;
    }

    const dbPassword = user.password;
    const matched = await bcrypt.compare(password, dbPassword);

    if (!matched) {
      res.status(400).json({
        message: `Credentials does not match`,
      });
      return;
    }

    const token = generateToken(user._id);
    res.status(200).json({
      message: "Login successful",
      user: {fullName: user.fullName, email: user.email, id: user._id},
      token,
    });
  } catch (err) {
    res.status(400).json({ message: "Error in login user", error: err });
  }
});

app.post("/sendMessage", authenticateUser, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const sender = req.user;
    const newMessage = await new Message({
      senderId: sender._id,
      receiverId,
      message,
    });
    await newMessage.save();

    const receiver = await User.findOne({ _id: newMessage.receiverId }).select(
      "-password"
    );
    res.status(200).json({
      message: "Message sent successfully",
      data: { senderId: sender, receiverId: receiver, message: newMessage.message }
    });
  } catch (err) {
    res.status(400).json({ message: "Error sending message", error: err });
  }
});

app.get("/users", authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const users = await User.find({ _id: { $ne: userId } }).select("-password");

    res
      .status(200)
      .json({ message: "fetched users successfully", data: users });
  } catch (err) {
    res.status(400).json({ message: "Error fetching users", error: err });
  }
});

app.post("/messages", authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { anotherUserId } = req.body;
    const messages = await Message.find({
      $or: [
        { $and: [{ senderId: userId }, { receiverId: anotherUserId }] },
        { $and: [{ senderId: anotherUserId }, { receiverId: userId }] },
      ],
    }).populate({
      path: "senderId receiverId",
      select: ["-password"],
    });

    res
      .status(200)
      .json({ message: "messages fetched successfully", data: messages });
  } catch (err) {
    res.status(400).json({ message: "Error fetching messages", error: err });
  }
});

app.listen(port, () => {
  console.log("listening on port " + port);
});
