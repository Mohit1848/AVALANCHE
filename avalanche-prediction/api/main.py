"""FastAPI Application Entrypoint for Avalanche Risk Intelligence."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from api.routes import health, prediction, telemetry, model, spatial, geography

app = FastAPI(
    title="Avalanche Risk Intelligence API",
    description=(
        "Research Decision-Support Backend Service for Spatiotemporal Avalanche Risk Prediction. "
        "Integrates CAIC field observations, NRCS SNOTEL continuous telemetry, Copernicus 30m DEM terrain, "
        "and a safety-critical Risk Engine."
    ),
    version="2.0.0-research",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for local web dashboards and research frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Validation Error Handler (Prevents Internal Stack Trace Leaks)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field_loc = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid input value")
        errors.append(f"{field_loc}: {msg}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "error_code": "INVALID_PAYLOAD_SCHEMA",
            "detail": "Input payload failed schema validation.",
            "validation_errors": errors,
            "disclaimer": "Research Decision-Support Service. Not certified as a standalone warning authority."
        }
    )


# Generic Exception Handler (Prevents Internal Stack Trace & Path Leaks)
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Processing Error",
            "error_code": "SERVER_ERROR",
            "detail": "An internal server error occurred while processing the request.",
            "disclaimer": "Research Decision-Support Service. Not certified as a standalone warning authority."
        }
    )


# Mount Route Handlers
app.include_router(health.router)
app.include_router(prediction.router)
app.include_router(telemetry.router)
app.include_router(model.router)
app.include_router(spatial.router)
app.include_router(geography.router)


@app.get("/", tags=["Root"])
def root():
    return {
        "service": "Avalanche Risk Intelligence API",
        "version": "2.0.0-research",
        "status": "online",
        "docs": "/docs",
        "disclaimer": "Research Decision-Support Service. Not certified as a standalone warning authority."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
