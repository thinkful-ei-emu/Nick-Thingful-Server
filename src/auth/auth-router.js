const express = require('express');
const AuthService = require('./auth-service');

const authRouter = express.Router();
const jsonBodyParser = express.json();

authRouter
  .post('/login', jsonBodyParser, (req, res, next) => {
    const { user_name, password } = req.body;
    const loginUser = { user_name, password };

    for (const [key, value] of Object.entries(loginUser))
      if (value == null)
        return res.status(400).json({
          error: `Missing '${key}' in request body`
        });
    AuthService.getUserWithUsername(
      req.app.get('db'),
      loginUser.user_name
    )
      .then(user => {
        if (!user)
          return res.status(400).json({
            error: 'Incorrect user_name or password'
          });
        return AuthService.comparePasswords(loginUser.password, user.password)
          .then(match => {
            if (!match)
              return res.status(400).json({
                error: 'Incorrect user_name or password'
              });
            const sub = user.user_name;
            const payload = { user_id: user.id};
            res.send({
              authToken: AuthService.createJwt(sub, payload),
            });
          });
      })
      .catch(next);
  });

module.exports = authRouter;