from zmk_runtime_cli import rpc


class _FakePort:
    def __init__(self, device, vid=None, hwid=""):
        self.device = device
        self.vid = vid
        self.hwid = hwid


def test_is_usb_serial_keeps_vid_and_usb_hwid():
    assert rpc._is_usb_serial(_FakePort("/dev/cu.usbmodem1", vid=0x1234))
    assert rpc._is_usb_serial(_FakePort("COM3", vid=None, hwid="USB VID:PID=1234:5678"))
    assert not rpc._is_usb_serial(_FakePort("/dev/ttyS0", vid=None, hwid=""))


def test_find_port_unique(monkeypatch):
    monkeypatch.setattr(rpc.list_ports, "comports",
                        lambda: [_FakePort("/dev/cu.usbmodem1", vid=0x1234),
                                 _FakePort("/dev/ttyS0", vid=None, hwid="")])
    assert rpc.find_port() == "/dev/cu.usbmodem1"


def test_find_port_zero_raises(monkeypatch):
    monkeypatch.setattr(rpc.list_ports, "comports",
                        lambda: [_FakePort("/dev/ttyS0", vid=None, hwid="")])
    import pytest
    with pytest.raises(RuntimeError):
        rpc.find_port()


def test_find_port_multiple_raises(monkeypatch):
    monkeypatch.setattr(rpc.list_ports, "comports",
                        lambda: [_FakePort("/dev/cu.usbmodem1", vid=0x1),
                                 _FakePort("/dev/cu.usbmodem2", vid=0x2)])
    import pytest
    with pytest.raises(RuntimeError) as e:
        rpc.find_port()
    assert "usbmodem1" in str(e.value) and "usbmodem2" in str(e.value)
