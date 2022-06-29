const express = require('express');

app.get('/', (req, res) => {
  res.send('HI!');
});

const PORT = process.env.PORT || 8080;
server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});