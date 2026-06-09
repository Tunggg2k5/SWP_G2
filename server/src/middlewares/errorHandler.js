export function notFound(req, _res, next) {
  const err = new Error(`Không tìm thấy API: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || err.status || 500;
  let message = statusCode === 500 ? "Lỗi hệ thống. Vui lòng thử lại sau." : err.message;
  let details = err.details;

  if (err.name === "ZodError") {
    statusCode = 400;
    message = "Dữ liệu không hợp lệ";
    details = err.issues;
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = "Dữ liệu đã tồn tại";
    details = err.keyValue;
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Mã dữ liệu không hợp lệ";
    details = { path: err.path };
  }

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    message,
    details: details || undefined
  });
}
