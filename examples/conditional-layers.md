# Runtime conditional layers example

Switch your `conditional_layers` node to the runtime compatible:

```dts
/ {
    conditional_layers {
        compatible = "zmk,runtime-conditional-layers";
        tri {
            if-layers = <1 2>;
            then-layer = <5>;
        };
    };
};
```
Edit at runtime (layers are a comma-separated list of if-layers, then the
then-layer):
```bash
zmkrt condlayer list
zmkrt condlayer set 0 1,2 5
zmkrt condlayer reset 0
```
Capacity: `CONFIG_ZMK_RUNTIME_CONDLAYERS_MAX` (default 16).
