import enum
from datetime import datetime
from typing import Annotated, Any, Optional, List, TypedDict, Unpack
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field, model_validator


class TransactionType(enum.Enum):
    """Enum for transaction types."""
    INCOME = "income"
    EXPENSE = "expense"

    def __str__(self):
        return self.value


def _parse_transaction_type(type_str: str) -> TransactionType:
    """Convert string to TransactionType enum."""
    type_str = type_str.lower().strip()
    if type_str == 'income' or type_str == 'credit':
        return TransactionType.INCOME
    elif type_str == 'expense' or type_str == 'debit':
        return TransactionType.EXPENSE
    else:
        raise ValueError(f"Invalid transaction type: {type_str}")


class BaseTransaction(BaseModel):
    amount_cents: int = 0
    type: TransactionType = TransactionType.EXPENSE

    @computed_field
    @property
    def amount_dollars(self) -> float:
        return self.amount_cents / 100.0

    @amount_dollars.setter
    def amount_dollars(self, value: float) -> None:
        self.amount_cents = int(value * 100)

    @computed_field
    @property
    def type_str(self) -> str:
        return self.type.value

    @type_str.setter
    def type_str(self, ts: str) -> None:
        self.type = _parse_transaction_type(ts)

    @model_validator(mode='before')
    @classmethod
    def trigger_computation(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'amount_dollars' in data:
                data['amount_cents'] = int(data.pop('amount_dollars') * 100)
            if 'type_str' in data:
                data['type'] = _parse_transaction_type(data.pop('type_str'))
        return data


CategoryStr = Annotated[str,
    StringConstraints(min_length=1, strip_whitespace=True, to_lower=True, ascii_only=False)]


class TransactionKwargs(TypedDict, total=False):
    category: CategoryStr
    date: datetime #Annotated[str, StringConstraints(pattern=r'^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$')]
    description: str
    tags: Optional[List[CategoryStr]]


class TransactionDTO(BaseTransaction):
    '''What the frontend sends.'''
    category: CategoryStr
# Source - https://stackoverflow.com/a/22061879
# Posted by Vinod, modified by community. See post 'Timeline' for change history
# Retrieved 2026-05-02, License - CC BY-SA 4.0
    date: datetime #Annotated[str, StringConstraints(pattern=r'^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$')]
    description: str = Field(min_length=1)
    tags: Optional[List[CategoryStr]] = None

    def __init__(
            self, *,
            amount_dollars: Optional[float] = None,
            amount_cents: int = 0,
            type: Optional[TransactionType] = None,
            type_str: Optional[str] = None,
            **kwargs: Unpack[TransactionKwargs]):
        if amount_cents is not None:
            kwargs['amount_cents'] = amount_cents # type: ignore
        if amount_dollars is not None:
            kwargs['amount_dollars'] = amount_dollars # type: ignore
        if type is not None:
            kwargs['type'] = type # type: ignore
        elif type_str is not None:
            kwargs['type_str'] = type_str # type: ignore

        super().__init__(**kwargs) # type: ignore

    @computed_field
    @property
    def is_income(self) -> bool:
        return self.type == TransactionType.INCOME


class RowDTO(BaseTransaction):
    '''What the backend returns to the frontend.'''
    id: int
    category: CategoryStr
    date: datetime
    description: str
    tags: str

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def is_income(self) -> bool:
        return self.type == TransactionType.INCOME

