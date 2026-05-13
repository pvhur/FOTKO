const argon2 = require('argon2');

const hashPassword = async (password) => {
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64MB
      timeCost: 3,
      parallelism: 1
    });
    return hash;
  } catch (error) {
    console.error('Hashing error:', error);
    throw error;
  }
};

const verifyPassword = async (inputPassword, storedHashedPassword) => {
  try {
    return await argon2.verify(storedHashedPassword, inputPassword);
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
};

module.exports = { hashPassword, verifyPassword };
