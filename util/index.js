const AWS = require("aws-sdk");

exports.deletePrvtFile = (fileName) => {
  const s3 = new AWS.S3({
    region: `${process.env.BUCKET_REGION_AWS}`,
    accessKeyId: `${process.env.ACCESS_KEY_AWS}`, // storage bucket key
    secretAccessKey: `${process.env.SECRET_KEY_AWS}`,
  });

  const paramsData = {
    Bucket: `${process.env.BUCKET_NAME_PRIVATE}`,
    Key: `backup-database/${fileName}`,
  };

  return new Promise((resolve, reject) => {
    s3.deleteObject(paramsData, function (err, data) {
      if (err) {
        reject("Failed to delete file");
      } else {
        resolve(data);
      }
    });
  });
};

exports.uploadPrivateFile = (fileContent, fileName) => {
  const s3 = new AWS.S3({
    region: `${process.env.BUCKET_REGION_AWS}`,
    accessKeyId: `${process.env.ACCESS_KEY_AWS}`, // storage bucket key
    secretAccessKey: `${process.env.SECRET_KEY_AWS}`,
  });

  const paramsData = {
    Body: fileContent,
    Bucket: `${process.env.BUCKET_NAME_PRIVATE}`,
    Key: `backup-database/${fileName}`,
  };

  return new Promise((resolve, reject) => {
    s3.putObject(paramsData, function (err, data) {
      if (err) {
        console.error("AWS S3 Upload Error:", err); // Log the specific error
        reject("No File");
      } else {
        resolve(data);
      }
    });
  });
};

exports.getPrivateFile = (file) => {
  const s3 = new AWS.S3({
    region: `${process.env.BUCKET_REGION_AWS}`,
    accessKeyId: `${process.env.ACCESS_KEY_AWS}`, // storage bucket key
    secretAccessKey: `${process.env.SECRET_KEY_AWS}`,
  });

  const params = {
    Bucket: process.env.BUCKET_NAME_PRIVATE || "stimi-yapmi",
    Key: `backup-database/${file}`,
  };
  console.log("uploadPrivateFile", {
    params,
    s3,
    "AWS.S3": {
      region: process.env.BUCKET_REGION_AWS,
      accessKeyId: process.env.ACCESS_KEY_AWS, // storage bucket key
      secretAccessKey: process.env.SECRET_KEY_AWS,
    },
  });

  return new Promise((resolve, reject) => {
    s3.getObject(params, function (err, data) {
      if (err) {
        console.error("AWS S3 Upload Error:", err); // Log the specific error
        reject("No Image");
      } else {
        resolve(data);
      }
    });
  });
};

exports.getBackupDatabse = async () => {
  const s3 = new AWS.S3({
    region: `${process.env.BUCKET_REGION_AWS}`,
    accessKeyId: `${process.env.ACCESS_KEY_AWS}`,
    secretAccessKey: `${process.env.SECRET_KEY_AWS}`,
  });

  const params = {
    Bucket: process.env.BUCKET_NAME_PRIVATE,
    Prefix: "backup-database/",
  };
  console.log("\n getBackupDatabse", {
    params,
    "AWS.S3": {
      region: `${process.env.BUCKET_REGION_AWS}`,
      accessKeyId: `${process.env.ACCESS_KEY_AWS}`,
      secretAccessKey: `${process.env.SECRET_KEY_AWS}`,
    },
  });

  return new Promise((resolve, reject) => {
    s3.listObjects(params, (err, data) => {
      if (err) {
        console.error("\n\n AWS S3 List Objects Error:", err);
        reject(err);
      } else {
        console.error("\n\n AWS S3 List Objects success:", data);
        const fileList = data.Contents.map((item) => item.Key);
        resolve(fileList);
      }
    });
  });
};

exports.downloadFile = async (fileName) => {
  const s3 = new AWS.S3({
    region: `${process.env.BUCKET_REGION_AWS}`,
    accessKeyId: `${process.env.ACCESS_KEY_AWS}`, // storage bucket key
    secretAccessKey: `${process.env.SECRET_KEY_AWS}`,
  });

  const params = {
    Bucket: `${process.env.BUCKET_NAME_PRIVATE}`,
    Key: `backup-database/${fileName}`,
  };

  const data = await s3.getObject(params).promise();

  return data;
};
