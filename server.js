var express = require("express");
var method = require("method-override");
var body = require("body-parser");
var exphbs = require("express-handlebars");
var mongoose = require("mongoose");
var logger = require("morgan");
var cheerio = require("cheerio");
// var request = require("request");
var axios = require("axios");

var Note = require("./models/note");
var Article = require("./models/article");
var databaseUrl = 'mongodb://localhost/mongoHeadlines';

if (process.env.MONGODB_URI) {
	mongoose.connect(process.env.MONGODB_URI);
}
else {
	mongoose.connect(databaseUrl);
};

mongoose.Promise = Promise;
var db = mongoose.connection;

db.on("error", function(error) {
	console.log("Mongoose Error: ", error);
});

db.once("open", function() {
	console.log("Mongoose connection successful.");
});


var PORT = process.env.PORT || 3000;
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";
mongoose.connect(MONGODB_URI);

var app = express();

app.use(express.json());
app.use(logger("dev"));
app.use(express.static("public"));
app.use(body.urlencoded({extended: false}));
app.use(method("_method"));
app.engine("handlebars", exphbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");

app.get("/", function(req, res) {
	Article.find({}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("placeholder", {message: "There's nothing scraped yet. Please click \"Scrape For Newest Articles\"."});
		}
		else{
			res.render("index", {articles: data});
		}
	});
});

app.get("/scrape", function(req, res) {
	axios.get("https://www.theverge.com/tech").then(function(response) {
	  var $ = cheerio.load(response.data);
  
	  $("h2").each(function(i, element) {
		var result = {};
  
		result.title = $(this)
		  .children("a")
		  .text();
		result.link = $(this)
		  .children("a")
		  .attr("href");

		  Article.create(result)
		  .then(function(Article) {
			// View the added result in the console
			console.log(Article);
		  })
		  .catch(function(err) {
			// If an error occurred, log it
			console.log(err);
		  });
  

	  });
  
	  // Send a message to the client
	//   res.send("Scrape Complete");
	});
  });
  





// axios.get("https://www.theverge.com/tech").then(function(response) {

// 	    var $ = cheerio.load(response.data);
	  
// 	    var results = [];
	  
// 	    $("h2").each(function(i, element) {
// 	      var title = $(element).text();
// 	      var link = $(element).find("a").attr("href");
// 	      results.push({
// 	        title: title,
// 			link: link
// 		  });
		  
// 		});
	  
// 	    console.log(results);
// 	  });
	  
app.get("/scrape", function(req, res) {
	request("https://www.theverge.com/tech", function(error, response, html) {
		var $ = cheerio.load(html);
		var result = [];
		$("div.story-body").each(function(i, element) {
			var title = $(element).text();
			var link = $(element).find("a").attr("href");
			result.link = link;
			result.title = title;
			var entry = new Article(result);
			Article.find({title: result.title}, function(err, data) {
				if (data.length === 0) {
					entry.save(function(err, data) {
						if (err) throw err;
					});
				}
			});
		});
		console.log("Scrape finished.");
		res.redirect("/");
	});
});

app.get("/saved", function(req, res) {
	Article.find({issaved: true}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("placeholder", {message: "You have not saved any articles yet. Try to save by simply clicking \"Save Article\"!"});
		}
		else {
			res.render("saved", {saved: data});
		}
	});
});

app.get("/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		res.json(data);
	})
})

app.post("/search", function(req, res) {
	console.log(req.body.search);
	Article.find({$text: {$search: req.body.search, $caseSensitive: false}}, null, {sort: {created: -1}}, function(err, data) {
		console.log(data);
		if (data.length === 0) {
			res.render("placeholder", {message: "Nothing has been found. Please try other keywords."});
		}
		else {
			res.render("search", {search: data})
		}
	})
});

app.post("/save/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		if (data.issaved) {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: false, status: "Save Article"}}, {new: true}, function(err, data) {
				res.redirect("/");
			});
		}
		else {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: true, status: "Saved"}}, {new: true}, function(err, data) {
				res.redirect("/saved");
			});
		}
	});
});

app.post("/note/:id", function(req, res) {
	var note = new Note(req.body);
	note.save(function(err, doc) {
		if (err) throw err;
		Article.findByIdAndUpdate(req.params.id, {$set: {"note": doc._id}}, {new: true}, function(err, newdoc) {
			if (err) throw err;
			else {
				res.send(newdoc);
			}
		});
	});
});

app.get("/note/:id", function(req, res) {
	var id = req.params.id;
	Article.findById(id).populate("note").exec(function(err, data) {
		res.send(data.note);
	})
})


// Start the server
app.listen(PORT, function() {
  console.log("App listening on port " + PORT);
});