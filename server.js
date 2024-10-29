const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
mongoose.connect('mongodb+srv://dbEsteemJK:qwerty786!A@esteem-jk.wwqurhe.mongodb.net/?retryWrites=true&w=majority&appName=Esteem-JK', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Database connection successful"))
  .catch(err => console.error("Database connection error:", err));

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'mohamedathikr.22msc@kongu.edu',
    pass: 'vkff fnsy cfea qhun'
  }
});

// User schema and model
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  age: Number,
  type: String,
  otp: String,
  otpExpires: Date
});

userSchema.pre('save', function(next) {
  if (this.isModified('password')) {
    bcrypt.hash(this.password, 10, (err, hash) => {
      if (err) return next(err);
      this.password = hash;
      next();
    });
  } else {
    next();
  }
});

const User = mongoose.model('User', userSchema, 'Users_1');

// Doctor schema and model
const doctorSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  serviceFee: String,
  availability: String,
  description: String,
  contactDetails: String,
  organization: String,
  experience: Number,
  name: String,
  image: String, 
  specialization: String 
});

const Doctor = mongoose.model('Doctor', doctorSchema, 'Doctors');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Send OTP route
app.get('/send-otp', async (req, res) => {
  const email = req.query.email;
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration

  try {
    const user = await User.findOneAndUpdate({ email }, { otp, otpExpires }, { new: true, upsert: true });

    if (user) {
      const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It is valid for 15 minutes.`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending OTP:', error);
          res.status(500).json({ success: false, message: 'Failed to send OTP' });
        } else {
          res.json({ success: true });
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'Failed to generate OTP' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify OTP route
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  User.findOne({ email })
    .then(user => {
      if (user && user.otp === otp && new Date() <= user.otpExpires) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }
    })
    .catch(error => {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ success: false, message: 'Server error' });
    });
});

// User signup route
app.post('/signup', (req, res) => {
  const { name, email, password, age, type, otp } = req.body;
  const normalizedType = (type || '').toLowerCase();

  User.findOne({ email })
    .then(existingUser => {
      if (!existingUser || existingUser.otp !== otp || new Date() > existingUser.otpExpires) {
        res.status(400).send("Invalid or expired OTP");
      } else {
        existingUser.name = name;
        existingUser.password = password;
        existingUser.age = age;
        existingUser.type = normalizedType;

        existingUser.save()
          .then(() => {
            console.log("User updated successfully");
            if (normalizedType === 'citizen') {
              res.redirect(`/home.html?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`);
            } else if (normalizedType === 'consultant') {
              res.redirect(`/doctor.html?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`);
            } else {
              res.status(400).send("Invalid user type");
            }
          })
          .catch((error) => {
            console.error("Error saving user:", error);
            res.status(500).send("Error updating user");
          });
      }
    })
    .catch(error => {
      console.error("Error checking for existing user:", error);
      res.status(500).send("Error checking for existing user");
    });
});

// User login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  User.findOne({ email })
    .then(user => {
      if (user) {
        bcrypt.compare(password, user.password, (err, result) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            res.status(500).send("Error logging in");
          } else if (result) {
            const normalizedType = (user.type || '').toLowerCase();
            if (normalizedType === 'citizen') {
              res.redirect(`/home.html?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`);
            } else if (normalizedType === 'consultant') {
              res.redirect(`/doctor.html?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`);
            } else {
              res.status(400).send("Invalid user type");
            }
          } else {
            res.status(401).send("Login Failed: Incorrect Email or Password");
          }
        });
      } else {
        res.status(401).send("Login Failed: Incorrect Email or Password");
      }
    })
    .catch(error => {
      console.error("Error logging in:", error);
      res.status(500).send("Error logging in");
    });
});

// Check doctor details route
app.get('/check-doctor-details', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).send("Email parameter is missing");
  }

  Doctor.findOne({ email })
    .then(doctor => {
      if (doctor) {
        res.json({
          details: doctor,
          exists: true 
        });
      } else {
        res.json({
          exists: false 
        });
      }
    })
    .catch(error => {
      console.error("Error checking doctor details:", error);
      res.status(500).send("Error checking doctor details");
    });
});

// Submit doctor details route with image upload
app.post('/submit-doctor-details', upload.single('image'), (req, res) => {
  const { email, name, serviceFee, availability, description, contactDetails, organization, experience, specialization } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '';

  Doctor.findOneAndUpdate(
    { email },
    { name, serviceFee, availability, description, contactDetails, organization, experience, image, specialization },
    { upsert: true, new: true }
  )
  .then(() => {
    res.redirect(`/doctor.html?email=${encodeURIComponent(email)}`);
  })
  .catch(error => {
    console.error("Error updating doctor details:", error);
    res.status(500).send("Error updating doctor details");
  });
});

// Get all doctors route
app.get('/doctors', (req, res) => {
  Doctor.find()
    .then(doctors => {
      res.json({ doctors });
    })
    .catch(error => {
      console.error("Error fetching doctors:", error);
      res.status(500).send("Error fetching doctors");
    });
});

app.post('/update-availability', (req, res) => {
  const { email, availabilityStatus } = req.body;
  
  Doctor.findOneAndUpdate({ email }, { availability: availabilityStatus }, { new: true })
    .then(updatedDoctor => {
      if (!updatedDoctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
      res.json({ success: true, message: 'Availability updated successfully!' });
    })
    .catch(error => {
      console.error('Error updating availability:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    });
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

