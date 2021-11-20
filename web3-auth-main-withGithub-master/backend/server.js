const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const userModel = require("./models/User");
const ethSig = require("eth-sig-util");
const ethUtil = require("ethereumjs-util");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GitHubStrategy = require("passport-github").Strategy;
const axios = require("axios");
const cookieSession = require("cookie-session");

const app = express();
const port = 8000;

app.use(bodyParser.json());
app.use(cors());

mongoose.connect(
  "<<Place mongo atlas db link here>>",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", function () {
  console.log("Connected successfully");
});
mongoose.set("debug", true);
userModel.findOneAndRemove({}, {}, function () {});
app.get("/users", function (req, res) {
  userModel
    .findOne({ publicAddress: req.query.publicAddress })
    //--snip--
    .then((user) => {
      console.log(user);
      if (!user) {
        return res.status(200).send({ message: "User not found" });
      }
      return res.status(200).send(user);
    });
});

app.post("/users", async function (req, res) {
  userModel
    .create(req.body)
    .then((user) => res.json(user))
    .catch((e) => console.log(e));
});

app.post("/auth", async function (req, res, next) {
  const { signature, publicAddress } = req.body;
  if (!signature || !publicAddress)
    return res
      .status(400)
      .send({ error: "Request should have signature and publicAddress" });

  return (
    userModel
      .findOne({ where: { publicAddress } })
      ////////////////////////////////////////////////////
      // Step 1: Get the user with the given publicAddress
      ////////////////////////////////////////////////////
      .then((user) => {
        if (!user) {
          res.status(401).send({
            error: `User with publicAddress ${publicAddress} is not found in database`,
          });

          return null;
        }

        return user;
      })
      ////////////////////////////////////////////////////
      // Step 2: Verify digital signature
      ////////////////////////////////////////////////////
      .then((user) => {
        if (!(user instanceof userModel)) {
          // Should not happen, we should have already sent the response
          throw new Error('User is not defined in "Verify digital signature".');
        }

        const msg = `I am signing my one-time nonce: ${user.nonce}`;

        // We now are in possession of msg, publicAddress and signature. We
        // will use a helper from eth-sig-util to extract the address from the signature
        const msgBufferHex = ethUtil.bufferToHex(Buffer.from(msg, "utf8"));

        const address = ethSig.recoverPersonalSignature({
          data: msgBufferHex,
          sig: signature,
        });

        console.log(address);

        // The signature verification is successful if the address found with
        // sigUtil.recoverPersonalSignature matches the initial publicAddress
        if (address.toLowerCase() === publicAddress.toLowerCase()) {
          return user;
        } else {
          res.status(401).send({
            error: "Signature verification failed",
          });

          return null;
        }
      })
      ////////////////////////////////////////////////////
      // Step 3: Generate a new nonce for the user
      ////////////////////////////////////////////////////
      .then((user) => {
        if (!(user instanceof userModel)) {
          // Should not happen, we should have already sent the response

          throw new Error(
            'User is not defined in "Generate a new nonce for the user".'
          );
        }

        user.nonce = Math.floor(Math.random() * 10000);
        return user.save();
      })
      ////////////////////////////////////////////////////
      // Step 4: Create JWT
      ////////////////////////////////////////////////////
      .then((user) => {
        return new Promise((resolve, reject) =>
          // https://github.com/auth0/node-jsonwebtoken
          jwt.sign(
            {
              payload: {
                publicAddress,
              },
            },
            "secret",
            {
              algorithm: "HS256",
            },
            (err, token) => {
              if (err) {
                return reject(err);
              }
              if (!token) {
                return new Error("Empty token");
              }
              return resolve(token);
            }
          )
        );
      })
      .then((accessToken) => res.json({ accessToken }))
      .catch(next)
  );
});

//------------------------------------------------------------------------------------ PassportJS
//Github Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: "<<Place secretId from github>>",
      clientSecret: "Place client secret from github",
      callbackURL: "/auth/github/callback",
    },
    (accessToken, refreshToken, profile, cb) => {
      userModel
        .create({ githubId: profile.id, username: profile.username })
        .catch((e) => console.log(e));
      createJwt(accessToken, profile.id).then((resultJwt) => {
        return cb(null, resultJwt);
      });
      //return cb(null, accessToken);
    }
  )
);

let user = {};

function createJwt(accessToken, id) {
  return new Promise((resolve, reject) =>
    // https://github.com/auth0/node-jsonwebtoken
    jwt.sign(
      {
        payload: {
          access_token: accessToken,
          githubId: id,
        },
      },
      "secret",
      {
        algorithm: "HS256",
      },
      (err, token) => {
        if (err) {
          return reject(err);
        }
        if (!token) {
          return new Error("Empty token");
        }
        return resolve(token);
      }
    )
  );
}

app.use(
  cookieSession({
    //maxAge: 24*60*60*1000,
    //keys:["xxx"]
    //cookie galioja tik 1min
    maxAge: 60000,
    keys: ["randomNumberIdentifierToIndexServersSessionCache"],
  })
);

//initialize passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((accessToken, done) => {
  done(null, accessToken);
});

passport.deserializeUser((accessToken, cb) => {
  cb(null, accessToken);
});

app.get("/auth/github", passport.authenticate("github"));

app.get(
  "/auth/github/callback",
  passport.authenticate("github"),
  (req, res) => {
    //if success
    if (req.user) {
      //req.user
      //res.send(req.user);
      res.cookie("jwt", req.user, { maxAge: 60000, httpOnly: false });
      res.redirect("http://localhost:3000");
    }
    res.status(404).send({ message: "not found" });
  }
);

app.get("/profile", (req, res) => {
  if (req.user) {
    res.send("you have logged id, your JWT token: " + req.user);
  } else {
    res.send("you havent logged in yet");
  }
});

// app.get("/auth/github", passport.authenticate("github"));

// app.get("/auth/github/callback",
//   passport.authenticate(("github"),
//     (req, res) => {
//       console.log(req)
//       //res.send(req);
//       res.redirect("/profile");
//     }));

app.get("/sync", (req, res) => {
  const token = req.headers["authentication"];
  try {
    const { payload } = jwt.verify(token, "secret");

    userModel.findOne({ githubId: payload.githubId }, function (err, data) {
      const sync =
        data?.githubId && data?.publicAddress
          ? "full"
          : data?.githubId
          ? "github"
          : "metamask";
      res.json({ sync });
    });
  } catch (err) {
    console.log(err);
  }
});

app.post("/sync/metamask", (req, res) => {
  const token = req.headers["authentication"];
  const { payload } = jwt.verify(token, "secret");
  const { signature } = req.body;
  console.log(signature);
  const msg = "sync";

  // We now are in possession of msg, publicAddress and signature. We
  // will use a helper from eth-sig-util to extract the address from the signature
  const msgBufferHex = ethUtil.bufferToHex(Buffer.from(msg, "utf8"));

  const address = ethSig.recoverPersonalSignature({
    data: msgBufferHex,
    sig: signature,
  });

  console.log(address.toLowerCase());
  try {
    userModel.findOneAndUpdate(
      { githubId: payload.githubId },
      { publicAddress: address.toLowerCase() },
      function (err, data) {
        console.log(err, data);
      }
    );
    res.json({ send: true });
  } catch (e) {
    console.log(e);
  }
});

app.post("/sync/github", passport.authenticate("github"));

app.get(
  "/sync/github/callback",
  passport.authenticate("github"),
  (req, res) => {
    //if success
    if (req.user) {
      //req.user
      //res.send(req.user);
      res.redirect("http://localhost:3000");
    }
    res.status(404).send({ message: "not found" });
  }
);

app.get("/user", (req, res) => {
  userModel.findOneAndRemove({ publicAddress: "0xdb5ca305bcbde29547e4df98ec3f2b05b15ac9e4" }, function (err, data) {
    console.log(err, data);
  });
  userModel.find({}).then((r) => res.json(r));
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
