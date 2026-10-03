"""Lecture binaire little-endian, avec les conventions de Blitz3D."""

from __future__ import annotations

import struct


class BinReader:
    def __init__(self, data: bytes, pos: int = 0):
        self.data = data
        self.pos = pos

    def eof(self) -> bool:
        return self.pos >= len(self.data)

    def _unpack(self, fmt: str):
        size = struct.calcsize(fmt)
        if self.pos + size > len(self.data):
            raise EOFError(f"lecture hors fichier à l'octet {self.pos}")
        values = struct.unpack_from(fmt, self.data, self.pos)
        self.pos += size
        return values

    def byte(self) -> int:
        return self._unpack("<B")[0]

    def int(self) -> int:
        return self._unpack("<i")[0]

    def float(self) -> float:
        return self._unpack("<f")[0]

    def vec3(self) -> tuple[float, float, float]:
        return self._unpack("<3f")

    def vec2(self) -> tuple[float, float]:
        return self._unpack("<2f")

    def vec4(self) -> tuple[float, float, float, float]:
        return self._unpack("<4f")

    def raw(self, n: int) -> bytes:
        if self.pos + n > len(self.data):
            raise EOFError(f"lecture hors fichier à l'octet {self.pos}")
        out = self.data[self.pos:self.pos + n]
        self.pos += n
        return out

    def string(self) -> str:
        """Chaîne Blitz3D : int32 de longueur puis les octets."""
        n = self.int()
        return self.raw(n).decode("latin-1")

    def cstring(self) -> str:
        """Chaîne terminée par un octet nul (format B3D)."""
        end = self.data.index(b"\0", self.pos)
        out = self.data[self.pos:end].decode("latin-1")
        self.pos = end + 1
        return out
