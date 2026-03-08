const bcrypt = require("bcrypt");

bcrypt.hash("ravi123", 10).then(hash => {
  console.log(hash);
  process.exit();
});
