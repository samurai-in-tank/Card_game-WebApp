const express = require('express')
const homeController = require('../controllers/homeController')
const loginController = require('../controllers/loginController')
const logoutController = require('../controllers/logoutController')
const registrationController = require('../controllers/registrationController')
const homeRouter = express.Router()

homeRouter.get('/', loginController.redirect, homeController.get)
homeRouter.post('/logout', logoutController.post)

homeRouter.get('/login', homeController.redirect, loginController.get)
homeRouter.post('/login', loginController.post)
homeRouter.post('/remind', loginController.remind)

homeRouter.get('/signup', homeController.redirect, registrationController.get)
homeRouter.post('/signup', registrationController.post)

module.exports = homeRouter

const express = require('express')
const expressThymeleaf = require('express-thymeleaf')
const {TemplateEngine} = require('thymeleaf')
const bodyParser = require('body-parser')
const session = require('express-session')
const PORT = process.env.PORT ?? 8080

const app = express()
const templateEngine = new TemplateEngine()
app.engine('html', expressThymeleaf(templateEngine))
app.set('view engine', 'html')
app.set('views', __dirname + '/views')
app.use(express.static(__dirname + '/public'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(
    session({
        secret: 'session secret',
        saveUninitialized: true
    })
)

const userRouter = require('./routes/userRouter')
const homeRouter = require('./routes/homeRouter')
app.use('/users', userRouter)
app.use('/', homeRouter)

app.use(function (req, res, next) {
    res.status(404).send('Not Found')
})

app.listen(PORT, () => {
    console.log(`Server has been started on port ${PORT}...`)
})

const joi = require('joi');

module.exports.registration = joi.object({
    full_name: joi.string().min(3).required(),
    login: joi.string().min(3).required(),
    email: joi.string().min(6).required().email(),
    password: joi.string().min(6).required(),
    confirm_password: joi.ref('password'),
})

module.exports.login = joi.object({
    login: joi.string().min(3).required(),
    password: joi.string().min(6).required(),
})

module.exports.remindPassword = joi.object({
    email: joi.string().min(6).required().email()
})
const express = require('express')
const expressThymeleaf = require('express-thymeleaf')
const {TemplateEngine} = require('thymeleaf')
const bodyParser = require('body-parser')

app.engine('html', expressThymeleaf(templateEngine))
app.set('view engine', 'html')
app.set('views', __dirname + '/')
app.use(express.static(__dirname + '/public'))
app.use(bodyParser.urlencoded({extended: false}))

const User = require('./models/user')

app.listen(PORT, () => {
    console.log(`Server has been started on port ${PORT}...`)
})

app.get('/', function (req, res) {
    res.render('./views/registration')
})

app.post('/signup', (req, res) => {
    let get = req.body
    if (!get) {
        return res.sendStatus(400)
    }
    if (get.login === '' || get.full_name === '' || get.email === '' || get.password === '') {
        return res.render('./views/registration', {
            login: get.login,
            full_name: get.full_name,
            email: get.email,
            errorMsg: 'Fields cannot be empty! Fill in all fields!'
        })
    }
    if (get.password !== get.confirm_password) {
        return res.render('./views/registration', {
            login: get.login,
            full_name: get.full_name,
            email: get.email,
            errorMsg: 'Password and Confirm password do not match! Try again...'
        })
    }
    let user = new User(get.login, get.password, get.full_name, get.email)
    user.request(res)
})
