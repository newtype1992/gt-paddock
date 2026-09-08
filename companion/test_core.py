import tempfile
import time
import unittest
from pathlib import Path
from core import Recorder, normalize
from main import private_ipv4
from types import SimpleNamespace as NS


def sample(i=1, lap=1, **extra):
    return dict(packet_id=i, car_id=1, captured_at=time.time()+i/10,
                speed=120, rpm=5500, gear=4, fuel=60, throttle=50, brake=0,
                lap=lap, last_lap_ms=90000 if lap>1 else None, best_lap_ms=None,
                tyres=[80]*4, paused=False, loading=False, on_track=True, **extra)


class RecorderTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.recorder=Recorder(str(Path(self.folder.name)/'test.sqlite'))

    def tearDown(self):
        self.recorder.db.close()
        self.folder.cleanup()

    def test_duplicate_packets_and_lap_transition(self):
        self.recorder.accept(sample())
        self.recorder.accept(sample())
        self.recorder.accept(sample(2,2))
        self.recorder.accept(sample(3,2))
        session=self.recorder.sessions()[0]
        self.assertEqual(session['samples'],3)
        self.assertEqual(session['laps'],[{'lap':1,'time_ms':90000}])
        self.assertEqual(len(self.recorder.history(session['id'])),3)

    def test_pause_loading_and_reset(self):
        self.recorder.accept(sample())
        paused=sample(2);paused['paused']=True
        self.recorder.accept(paused)
        self.assertEqual(self.recorder.sessions()[0]['samples'],1)
        self.recorder.accept(sample(3,2))
        self.assertEqual(self.recorder.current['laps'],[])
        self.recorder.accept(sample(4,1))
        self.assertEqual(len(self.recorder.sessions()),2)

    def test_signal_loss_is_not_live(self):
        old=sample();old['captured_at']=time.time()-10
        self.recorder.accept(old)
        self.assertTrue(self.recorder.status()['stale'])

    def test_inactive_packets_never_record_and_exit_ends_immediately(self):
        for flags in ({'on_track': False}, {'loading': True},
                      {'on_track': False, 'paused': True}):
            with self.subTest(flags=flags):
                active = sample(1)
                self.recorder.accept(active)
                session_id = self.recorder.current['id']
                inactive = sample(2, 2)
                inactive.update(flags, speed=999)
                self.recorder.accept(inactive)
                self.assertIsNone(self.recorder.current)
                self.assertEqual(self.recorder.last_finished['samples'], 1)
                self.assertEqual(self.recorder.last_finished['top_speed'], 120)
                self.assertEqual(self.recorder.last_finished['laps'], [])
                self.assertEqual(len(self.recorder.history(session_id)), 1)
                inactive['packet_id'] = 3
                self.recorder.accept(inactive)
                self.assertIsNone(self.recorder.current)
                self.recorder.accept(sample(4))
                self.assertNotEqual(self.recorder.current['id'], session_id)
                self.recorder.finish('left_track')

    def test_only_home_network_targets(self):
        self.assertEqual(private_ipv4('192.168.2.20'),'192.168.2.20')
        for ip in ['8.8.8.8','127.0.0.1','169.254.169.254','::1']:
            with self.assertRaises(Exception):private_ipv4(ip)

    def test_unit_conversion(self):
        wheel=NS(temperature=82)
        packet=NS(packet_id=1,car_id=1,received_time=time.time(),car_speed=10,
                  engine_rpm=5000,current_gear=3,gas_level=50,throttle=255,brake=0,
                  lap_count=1,last_lap_time=None,best_lap_time=None,
                  wheels=NS(front_left=wheel,front_right=wheel,rear_left=wheel,rear_right=wheel),
                  flags=NS(paused=False,loading_or_processing=False,car_on_track=True))
        result=normalize(packet)
        self.assertEqual(result['speed'],36)
        self.assertEqual(result['throttle'],100)

    def test_long_pause_keeps_session_and_reset_starts_new(self):
        first=sample(); first['captured_at']=100
        self.recorder.accept(first)
        original=self.recorder.current['id']
        for i in range(1,30):
            paused=sample(i+1); paused.update(captured_at=100+i,paused=True)
            self.recorder.accept(paused)
        resumed=sample(40);resumed['captured_at']=130
        self.recorder.accept(resumed)
        self.assertEqual(self.recorder.current['id'],original)
        self.assertEqual(self.recorder.current['gaps'],0)
        reset=sample(41,0);reset['captured_at']=130.1
        self.recorder.accept(reset)
        self.assertNotEqual(self.recorder.current['id'],original)
        saved=next(s for s in self.recorder.sessions() if s['id']==original)
        self.assertEqual(saved['end_reason'],'lap_reset')

    def test_offtrack_and_signal_timeout_finalize(self):
        active=sample();active['captured_at']=100
        self.recorder.accept(active)
        self.recorder.tick(104)
        self.assertEqual(self.recorder.current['state'],'signal_lost')
        self.recorder.tick(111)
        self.assertIsNone(self.recorder.current)
        self.assertEqual(self.recorder.last_finished['state'],'interrupted')
        active=sample(2);active['captured_at']=120
        self.recorder.accept(active)
        for i in range(7):
            off=sample(3+i);off.update(captured_at=121+i,on_track=False)
            self.recorder.accept(off)
        self.assertIsNone(self.recorder.current)
        self.assertEqual(self.recorder.last_finished['end_reason'],'left_track')

    def test_restart_recovers_incomplete_session_without_losing_samples(self):
        self.recorder.accept(sample())
        path=str(Path(self.folder.name)/'test.sqlite')
        self.recorder.db.close()
        self.recorder=Recorder(path)
        saved=self.recorder.sessions()[0]
        self.assertEqual(saved['state'],'interrupted')
        self.assertEqual(len(self.recorder.history(saved['id'])),1)


if __name__=='__main__':unittest.main()
