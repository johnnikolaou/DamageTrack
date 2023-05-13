import express from 'express';
import fs from 'fs/promises';
import { Location, Category, Report, User } from './model/model.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const reports = await Report.find({ user: req.session.user_id }).populate("category").populate("location").lean();
  res.render('homepage', {
    session: req.session.mySessionName,
    css: "index.css",
    reports
  });
});

router.get('/sign', (req, res) => {
  if (req.session.mySessionName == undefined) {
    res.render('signupLogin', {
      css: "signupLogin.css",
      js: "signupLogin.js"
    });
  }
  else {
    res.redirect('/');
  }
});

router.get("/logout", (req, res) => {
  if (req.session.mySessionName == undefined) {
    res.redirect('/');
  }
  else {
    req.session.destroy((err) => { console.log("session destroyed") });
    res.redirect('/');
  }
})

router.post("/login", async (req, res) => {
  let user = await User.find({
    email: req.body['loginEmail'],
    password: req.body['loginPassword']
  }).limit(1);

  // User not authenticated
  if (user.length === 0) {
    res.redirect('/sign');
  }
  else {
    if (req.session.mySessionName == undefined) {
      req.session.mySessionName = 'damageTrack-session';
      req.session.user_id = user[0]['_id'];
      res.redirect('/');
    }
    else {
      res.redirect('/');
    }
  }
});

router.post("/signup", async (req, res) => {
  let newUser = new User({
    email: req.body['signUpEmail'],
    password: req.body['signUpPassword'],
    firstName: req.body['signUpFirstName'],
    lastName: req.body['signUpLastName'],
    phone: req.body['signUpPhone'],
    city: req.body['signUpCity']
  });

  await newUser.save();

  res.redirect('/');
});

router.get('/report', (req, res) => {
  res.render('reportForm', { layout: 'report' });
});

router.post('/report', async (req, res) => {
  try {
    // Extract the necessary data from the request body
    const { category, description, city, streetName, streetNumber, zipCode } = req.body;
    const activeUser = req.session.user_id;
    const urgencyMapping = ['Low', 'Medium', 'High'];
    const urgencyValue = urgencyMapping[req.body.urgency];

    // Get the file that was set to our field named "image"
    const { image } = req.files;

    // If no image submitted, exit
    if (!image) return res.sendStatus(400);

    // If does not have image mime type prevent from uploading
    // Need to do this client side first !!
    if (! /^image/.test(image.mimetype)) {
      return res.sendStatus(400);
    }

    let path = 'public/images/' + image.name;

    try {
      await fs.access(path);
    } catch (err) {
      console.log(`${path} does not exist`);
      await image.mv('public/images/' + image.name);
    }

    // Find or create the location based on the provided data
    let location = await Location.findOne({ city, streetName, streetNumber, zipCode });
    if (!location) {
      location = new Location({ city, streetName, streetNumber, zipCode });
      await location.save();
    }

    // Find or create the category based on the provided type
    let newCategory = await Category.findOne({ name: category });
    if (!newCategory) {
      newCategory = new Category({ name: category });
      await newCategory.save();
    }

    // Create a new instance of the Report model with the extracted data and the location and category objects
    const report = new Report({
      description,
      user: activeUser,
      location,
      category: newCategory,
      status: 'Pending',
      image: image.name,
      urgency: urgencyValue,
      likes: 0
    });

    // Save the report to the database
    const savedReport = await report.save();

    res.redirect('/')
  } catch (err) {
    res.status(500).json({ error: err.message }); // Handle any errors
  }
});



router.get('/admin', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 3; 
        const totalReports = await Report.countDocuments(); 
        const totalPages = Math.ceil(totalReports / limit); 
        const skip = (page - 1) * limit; 

        const { urgency, status } = req.query;
        const query = {};

        if (urgency && urgency !== 'all') {
            query.urgency = urgency;
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        const reports = await Report.find(query)
            .populate('category')
            .populate('location')
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('adminDashboard', { layout: 'admin', reports, totalPages, currentPage: page });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




export { router };