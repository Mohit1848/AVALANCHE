"""FastAPI dependencies and service singletons."""

from api.services.inference_service import inference_engine, AvalancheInferenceEngine


def get_inference_engine() -> AvalancheInferenceEngine:
    """Dependency injector for inference engine."""
    return inference_engine
