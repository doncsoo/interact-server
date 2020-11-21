
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../index');
const suppressLogs = require('mocha-suppress-logs');

chai.use(chaiHttp);
chai.should();

function makeid(length) {
    let result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

const new_user = makeid(15);

//The following test's json values are not valid to be used in frontend website, 
//and should only be used to test the backend server functionalities.

describe("Test GET methods", () => {
    suppressLogs();
    describe("Test /get-videos", () => {
        it("Get all videos in database", (done) => {
             chai.request(app)
                 .get('/get-videos/all')
                 .end((err, res) => {
                     res.should.have.status(200);
                     //expected: an array of all videos
                     i = 0;
                     for(vid of res.body)
                     {
                        vid.id.should.equal(i);
                        i++;
                     }
                     done();
                });
        });
        it("Get videos for an non-existing user", (done) => {
            chai.request(app)
                .get('/get-videos/idontexist')
                .end((err, res) => {
                    res.should.have.status(200);
                    //expected: [] - empty array
                    res.body.should.have.lengthOf(0);
                    done();
                });
       });
       it("Get videos for an existing user", (done) => {
        chai.request(app)
            .get('/get-videos/jason')
            .end((err, res) => {
                res.should.have.status(200);
                //expected: array of videos owned by 'jason'
                for(vid of res.body) vid.owner.should.equal('jason');
                done();
            });
        });
        it("No user identifier - invalid", (done) => {
            chai.request(app)
                .get('/get-videos')
                .end((err, res) => {
                    res.should.have.status(404);
                    done();
                });
            });
    });
    describe("Test /search-query", () => {
        it("Search for simple keyword", (done) => {
            chai.request(app)
                .get('/search-query/content')
                .end((err, res) => {
                    res.should.have.status(200);
                    //expected: array of videos that contains the 'content' keyword
                    for(vid of res.body)
                    {
                        vid.should.satisfy(function(vid) {
                            let name = vid.name.toLowerCase()
                            let description = vid.description.toLowerCase()

                            return name.includes('content') || description.includes('content');
                        });
                    }
                    done();
                });
        });
        it("No keyword - invalid", (done) => {
            chai.request(app)
                .get('/search-query')
                .end((err, res) => {
                    res.should.have.status(404);
                    done();
                });
            });
    });
    describe("Test /get-video", () => {
        it("Search for video with specific id", (done) => {
            chai.request(app)
                .get('/get-video/1')
                .end((err, res) => {
                    res.should.have.status(200);
                    //expected: array of videos that contains the 'content' keyword
                    res.body[0].id.should.equal(1);
                    done();
                });
        });
        it("Invalid id (not number supplied) - invalid", (done) => {
            chai.request(app)
                .get('/get-video/hello')
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
            });
        it("No id - invalid", (done) => {
            chai.request(app)
                .get('/get-video')
                .end((err, res) => {
                    res.should.have.status(404);
                    done();
                });
            });
    });
    describe("Test /get-tree", () => {
        it("Get a video's json tree", (done) => {
            chai.request(app)
                .get('/get-tree/0')
                .end((err, res) => {
                    res.should.have.status(200);
                    //res.body[0].tree.should.deep.equal({note:"This is only used for REST API testing purposes."});
                    done();
                });
        });
        it("Invalid id (not number supplied) - invalid", (done) => {
            chai.request(app)
                .get('/get-tree/hello')
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
            });
        it("No id - invalid", (done) => {
            chai.request(app)
                .get('/get-tree')
                .end((err, res) => {
                    res.should.have.status(404);
                    done();
                });
            });
    });
    describe("Test /get-fav-videos", () => {
        it("Get a person's favorite videos list", (done) => {
            chai.request(app)
                .get('/get-fav-videos/admin')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body[0].likes.should.deep.equal([0,1]);
                    done();
                });
        });
        it("No user supplied - invalid", (done) => {
            chai.request(app)
                .get('/get-fav-videos')
                .end((err, res) => {
                    res.should.have.status(404);
                    done();
                });
        });
    });
    describe("Test /verify-token", () => {
        it("Valid token", (done) => {
            chai.request(app)
                .get('/verify-token/3252354545')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.text.should.equal("VALID");
                    done();
                });
        });
        it("Invalid token", (done) => {
            chai.request(app)
                .get('/verify-token/6666666666')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.text.should.equal("INVALID");
                    done();
                });
        });
        it("No token supplied - invalid behaviour", (done) => {
            chai.request(app)
                .get('/verify-token')
                .end((err, res) => {
                    res.should.have.status(404);
                    done();
                });
        });
    });
});
describe("Test PUT methods", () => {
    suppressLogs();
    describe("Test /content", () => {
        it("Upload simple content", (done) => {
            chai.request(app)
                .put('/content')
                .set('content-type', 'application/json')
                .send({name: "123456", desc: "desc", token: 3252354545})
                .end((err, res) => {
                    res.should.have.status(201);
                    done();
                });
        });
        it("Try to upload without token - invalid", (done) => {
            chai.request(app)
                .put('/content')
                .set('content-type', 'application/json')
                .send({name: "123456", desc: "desc"})
                .end((err, res) => {
                    res.should.have.status(401);
                    done();
                });
        });
    });
    describe("Test /like", () => {
        it("Like a content", (done) => {
            chai.request(app)
                .put('/like')
                .set('content-type', 'application/json')
                .send({token: 3252354545, video_id: 0})
                .end((err, res) => {
                    res.should.have.status(201);
                    done();
                });
        });
        it("Try to like without token - invalid", (done) => {
            chai.request(app)
                .put('/like')
                .set('content-type', 'application/json')
                .send({token: 6666666666, video_id: 0})
                .end((err, res) => {
                    res.should.have.status(401);
                    done();
                });
        });
    });
    describe("Test /register", () => {
        it("Create an account", (done) => {
            chai.request(app)
                .put('/register')
                .set('content-type', 'application/json')
                .send({username: new_user, password: "test", fullname: "TESTING REGISTER"})
                .end((err, res) => {
                    res.should.have.status(201);
                    done();
                });
        });
        it("Try create account with already existing username - invalid", (done) => {
            chai.request(app)
                .put('/register')
                .set('content-type', 'application/json')
                .send({username: "test", password: "test", fullname: "TESTING REGISTER"})
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
        });
        it("Missing password - invalid", (done) => {
            chai.request(app)
                .put('/register')
                .set('content-type', 'application/json')
                .send({username: "somebody", fullname: "TESTING REGISTER"})
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
        });
    });
});
describe("Test POST methods", () => {
    suppressLogs();
    describe("Test /content", () => {
        it("Modify content's tree", (done) => {
            chai.request(app)
                .post('/content')
                .set('content-type', 'application/json')
                .send({id: 0, token: 3252354545, tree: {title: "test video", start_video: null, videos: []}})
                .end((err, res) => {
                    res.should.have.status(201);
                    done();
                });
        });
        it("Attempt to modify content with other owner - invalid", (done) => {
            chai.request(app)
                .post('/content')
                .set('content-type', 'application/json')
                .send({id: 0, token: 1111111111, tree: {title: "test video", start_video: null, videos: []}})
                .end((err, res) => {
                    res.should.have.status(403);
                    done();
                });
        });
        it("Tree missing - invalid", (done) => {
            chai.request(app)
                .post('/content')
                .set('content-type', 'application/json')
                .send({id: 0, token: 3252354545})
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
        });
    });
    describe("Test /upload-choices", () => {
        it("Upload choices", (done) => {
            chai.request(app)
                .post('/upload-choices')
                .set('content-type', 'application/json')
                .send({token: 3252354545, vidid: 0, choices: ["a choice"]})
                .end((err, res) => {
                    res.should.have.status(201);
                    done();
                });
        });
        it("Attempt upload content with invalid token - invalid", (done) => {
            chai.request(app)
                .post('/upload-choices')
                .set('content-type', 'application/json')
                .send({token: 6666666666, vidid: 0, choices: ["a choice"]})
                .end((err, res) => {
                    res.should.have.status(401);
                    done();
                });
        });
        it("Missing id and choices - invalid", (done) => {
            chai.request(app)
                .post('/upload-choices')
                .set('content-type', 'application/json')
                .send({token: 3252354545})
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
        });
    });
    describe("Test /user-verify", () => {
        it("Verify user - log in", (done) => {
            chai.request(app)
                .post('/user-verify')
                .set('content-type', 'application/json')
                .send({username: new_user, password: "test"})
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.verified.should.equal(true);
                    done();
                });
        });
        it("Invalid password - invalid", (done) => {
            chai.request(app)
                .post('/user-verify')
                .set('content-type', 'application/json')
                .send({username: new_user, password: "123456"})
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.should.deep.equal({verified: false, error: "Invalid password"});
                    done();
                });
        });
        it("Nonexisting user - invalid", (done) => {
            chai.request(app)
                .post('/user-verify')
                .set('content-type', 'application/json')
                .send({username: "anonymous", password: "123456"})
                .end((err, res) => {
                    res.should.have.status(401);
                    res.body.should.deep.equal({verified: false, error: "The following user doesn't exist"});
                    done();
                });
        });
        it("Missing parameters - invalid", (done) => {
            chai.request(app)
                .post('/user-verify')
                .set('content-type', 'application/json')
                .send({})
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
        });
    });
    describe("Test /prereq-choices", () => {
        it("Get choices", (done) => {
            chai.request(app)
                .post('/prereq-choices')
                .set('content-type', 'application/json')
                .send({token: 3252354545, vidid: 0})
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body[0].choices[0].should.equal("a choice");
                    done();
                });
        });
        it("Missing token and vidid - invalid", (done) => {
            chai.request(app)
                .post('/prereq-choices')
                .set('content-type', 'application/json')
                .send({})
                .end((err, res) => {
                    res.should.have.status(400);
                    done();
                });
        });
    });
});
describe("Test DELETE methods", () => {
    suppressLogs();
    describe("Test /content", () => {
        it("Delete content", (done) => {
            chai.request(app)
                .delete('/content')
                .set('content-type', 'application/json')
                .send({id: 3, token: 3252354545})
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
        it("Attempt to delete content with other owner - invalid", (done) => {
            chai.request(app)
                .delete('/content')
                .set('content-type', 'application/json')
                .send({id: 0, token: 1111111111})
                .end((err, res) => {
                    res.should.have.status(403);
                    done();
                });
        });
    });
    describe("Test /like", () => {
        it("Remove a like from a content", (done) => {
            chai.request(app)
                .delete('/like')
                .set('content-type', 'application/json')
                .send({token: 3252354545, video_id: 0})
                .end((err, res) => {
                    res.should.have.status(201);
                    done();
                });
        });
        it("Try to remove like without token - invalid", (done) => {
            chai.request(app)
                .delete('/like')
                .set('content-type', 'application/json')
                .send({token: 6666666666, video_id: 0})
                .end((err, res) => {
                    res.should.have.status(401);
                    done();
                });
        });
    });
});

