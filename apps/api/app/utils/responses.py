from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class DataResponse(BaseModel, Generic[T]):
    """Standard success envelope: `{"data": ...}`."""

    data: T


def ok(data: T) -> DataResponse[T]:
    return DataResponse[T](data=data)
